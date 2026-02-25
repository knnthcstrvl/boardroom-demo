<?php

namespace App\Http\Controllers\Api;

use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Mail\ReservationApprovalRequestMail;
use App\Models\MeetingRoom;
use App\Models\Reservation;
use App\Models\User;
use App\Support\ReservationEvents;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Http\Request;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ReservationController extends Controller
{
    private const DEPARTMENTS = [
        'Academic Department',
        'Admissions and Financial Aid Department',
        'Campus Development Department',
        'Executive Vice Chair',
        'Executive Vice President',
        'External Affairs Office',
        'Finance Department',
        'Human Resource Department',
        'Information Technology Department',
        'Institutional Research Office',
        'Internal Audit Office',
        'Lead Institute',
        'Library Services Department',
        'Marketing Department',
        'Office of the President',
        'Office of the Registrar',
        'Quality Assurance Office',
        'Research Ethics Office',
        'Student Affairs Services',
    ];

    public function index(Request $request)
    {
        $validated = $request->validate([
            'meeting_room_id' => ['sometimes', 'integer', 'exists:meeting_rooms,id'],
            'start' => ['sometimes', 'date'],
            'end' => ['sometimes', 'date', 'after_or_equal:start'],
            'status' => ['sometimes', 'array'],
            'status.*' => ['string', Rule::in(array_map(fn (ReservationStatus $s) => $s->value, ReservationStatus::cases()))],
            'q' => ['sometimes', 'string', 'max:200'],
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'time_from' => ['sometimes', 'date_format:H:i'],
            'time_to' => ['sometimes', 'date_format:H:i'],
            'recurring' => ['sometimes', 'boolean'],
            'title' => ['sometimes', 'string', 'max:255'],
            'requested_by' => ['sometimes', 'string', 'max:255'],
            'approved_by' => ['sometimes', 'string', 'max:255'],
            'sort_by' => ['sometimes', 'string', Rule::in(['created_at', 'start_at', 'end_at', 'title', 'requested_by', 'approved_by', 'status', 'rejected_reason', 'recurring'])],
            'sort_dir' => ['sometimes', 'string', Rule::in(['asc', 'desc'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $meetingRoomId = $validated['meeting_room_id'] ?? MeetingRoom::query()->where('is_active', true)->value('id');

        $query = Reservation::query()
            ->with(['requester:id,name,email', 'approver:id,name,email'])
            ->where('meeting_room_id', $meetingRoomId)
            ->orderBy('start_at');

        if (! empty($validated['start'])) {
            $query->where('end_at', '>', $validated['start']);
        }

        if (! empty($validated['end'])) {
            $query->where('start_at', '<', $validated['end']);
        }

        if (! empty($validated['status'])) {
            $query->whereIn('status', $validated['status']);
        }

        $wantsPagination = array_key_exists('per_page', $validated) || $request->has('page');
        $wantsAdminFiltering = ! empty($validated['q'])
            || ! empty($validated['date'])
            || ! empty($validated['time_from'])
            || ! empty($validated['time_to'])
            || $request->has('recurring')
            || ! empty($validated['title'])
            || ! empty($validated['requested_by'])
            || ! empty($validated['approved_by'])
            || ! empty($validated['sort_by'])
            || ! empty($validated['sort_dir']);

        if ($wantsPagination || $wantsAdminFiltering) {
            $query
                ->leftJoin('users as requester_user', 'requester_user.id', '=', 'reservations.requested_by')
                ->leftJoin('users as approver_user', 'approver_user.id', '=', 'reservations.approved_by')
                ->select('reservations.*');

            if (! empty($validated['q'])) {
                $term = trim((string) $validated['q']);
                if ($term !== '') {
                    $query->where(function ($q) use ($term) {
                        $q->where('reservations.title', 'like', "%{$term}%")
                            ->orWhere('reservations.requester_email', 'like', "%{$term}%")
                            ->orWhere('reservations.requester_department', 'like', "%{$term}%")
                            ->orWhere('reservations.rejected_reason', 'like', "%{$term}%")
                            ->orWhere('reservations.status', 'like', "%{$term}%")
                            ->orWhere('requester_user.email', 'like', "%{$term}%")
                            ->orWhere('requester_user.name', 'like', "%{$term}%")
                            ->orWhere('approver_user.email', 'like', "%{$term}%")
                            ->orWhere('approver_user.name', 'like', "%{$term}%");
                    });
                }
            }

            if (! empty($validated['date'])) {
                $query->whereDate('reservations.start_at', '=', $validated['date']);
            }

            $hasTimeFrom = ! empty($validated['time_from']);
            $hasTimeTo = ! empty($validated['time_to']);
            if (! empty($validated['date']) && ($hasTimeFrom || $hasTimeTo)) {
                $day = Carbon::createFromFormat('Y-m-d', $validated['date'])->startOfDay();
                $rangeStart = $hasTimeFrom
                    ? Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$validated['time_from']}")
                    : $day->copy();
                $rangeEnd = $hasTimeTo
                    ? Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$validated['time_to']}")
                    : $day->copy()->endOfDay();

                if ($rangeEnd->lte($rangeStart)) {
                    $rangeEnd = $rangeStart->copy()->addMinute();
                }

                // Overlap filter: any reservation intersecting the time window.
                $query
                    ->where('reservations.start_at', '<', $rangeEnd)
                    ->where('reservations.end_at', '>', $rangeStart);
            } else {
                if ($hasTimeFrom || $hasTimeTo) {
                    $from = $hasTimeFrom ? $validated['time_from'] : '00:00';
                    $to = $hasTimeTo ? $validated['time_to'] : '23:59';
                    if ($to <= $from) {
                        // Treat an inverted window as a no-op rather than returning confusing results.
                        $to = '23:59';
                    }

                    // Overlap filter by time-of-day (independent of date).
                    $query
                        ->whereTime('reservations.start_at', '<', $to)
                        ->whereTime('reservations.end_at', '>', $from);
                }
            }

            if ($request->has('recurring')) {
                $query->where('reservations.repeat_enabled', $request->boolean('recurring'));
            }

            if (! empty($validated['title'])) {
                $term = trim((string) $validated['title']);
                if ($term !== '') {
                    $query->where('reservations.title', 'like', "%{$term}%");
                }
            }

            if (! empty($validated['requested_by'])) {
                $term = trim((string) $validated['requested_by']);
                if ($term !== '') {
                    $query->where(function ($q) use ($term) {
                        $q->where('reservations.requester_email', 'like', "%{$term}%")
                            ->orWhere('requester_user.email', 'like', "%{$term}%")
                            ->orWhere('requester_user.name', 'like', "%{$term}%");
                    });
                }
            }

            if (! empty($validated['approved_by'])) {
                $term = trim((string) $validated['approved_by']);
                if ($term !== '') {
                    $query->where(function ($q) use ($term) {
                        $q->where('approver_user.email', 'like', "%{$term}%")
                            ->orWhere('approver_user.name', 'like', "%{$term}%");
                    });
                }
            }

            $sortBy = (string) ($validated['sort_by'] ?? 'created_at');
            $sortDir = (string) ($validated['sort_dir'] ?? 'desc');

            $query->reorder();
            $sortExpr = match ($sortBy) {
                'requested_by' => 'COALESCE(reservations.requester_email, requester_user.email)',
                'approved_by' => 'approver_user.email',
                'recurring' => 'reservations.repeat_enabled',
                default => "reservations.{$sortBy}",
            };

            $query->orderByRaw("{$sortExpr} {$sortDir}")
                ->orderBy('reservations.id', 'desc');

            if ($wantsPagination) {
                $perPage = (int) ($validated['per_page'] ?? 10);
                $page = max(1, (int) $request->input('page', 1));

                return $this->paginateUniqueSeries(
                    request: $request,
                    query: $query,
                    sortExpr: $sortExpr,
                    sortDir: $sortDir,
                    perPage: $perPage,
                    page: $page,
                );
            }
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'meeting_room_id' => ['required', 'integer', 'exists:meeting_rooms,id'],
            'title' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'department' => ['required', 'string', Rule::in(self::DEPARTMENTS)],
            'attendees' => ['required', 'integer', 'min:1', 'max:18'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after:start_at'],
            'repeat' => ['sometimes', 'array'],
            'repeat.enabled' => ['sometimes', 'boolean'],
            'repeat.unit' => ['sometimes', 'string', Rule::in(['week', 'month'])],
            'repeat.weeks' => ['sometimes', 'integer', 'min:1', 'max:52'],
            'repeat.days' => ['sometimes', 'array'],
            'repeat.days.*' => ['integer', 'min:1', 'max:5'], // 1=Mon..5=Fri
            'repeat.start_date' => ['sometimes', 'date'],
        ]);

        $startAt = Carbon::parse($validated['start_at']);
        $endAt = Carbon::parse($validated['end_at']);
        abort_unless($startAt->gte(now()), 422, 'Cannot reserve a meeting in the past.');

        $actor = $request->user();

        $repeat = $validated['repeat'] ?? [];
        $repeatEnabled = (bool) ($repeat['enabled'] ?? false);
        $repeatUnit = $repeatEnabled ? (string) ($repeat['unit'] ?? 'week') : null;
        if ($repeatEnabled && ! in_array($repeatUnit, ['week', 'month'], true)) {
            return response()->json(['message' => 'Invalid repeat unit.'], 422);
        }
        $repeatWeeks = $repeatEnabled ? (int) ($repeat['weeks'] ?? 1) : null;
        if ($repeatEnabled && $repeatUnit === 'month' && $repeatWeeks !== null && $repeatWeeks > 24) {
            return response()->json(['message' => 'Monthly repeats can be at most 24 months.'], 422);
        }
        $repeatDays = $repeatEnabled ? array_values(array_unique(array_map('intval', $repeat['days'] ?? []))) : [];
        sort($repeatDays);

        $repeatStartDate = $repeatEnabled
            ? Carbon::parse($repeat['start_date'] ?? $startAt->copy()->toDateString())->startOfDay()
            : null;
        if ($repeatEnabled) {
            abort_unless($repeatStartDate->gte(now()->startOfDay()), 422, 'Cannot start a recurring meeting in the past.');
        }

        if ($repeatEnabled && empty($repeatDays)) {
            return response()->json(['message' => 'Choose at least one repeat day.'], 422);
        }

        $seriesId = $repeatEnabled ? (string) Str::uuid() : null;

        $createdCount = 0;
        $firstCreatedReservation = null;

        $occurrences = $this->buildStoreOccurrences(
            startAt: $startAt,
            endAt: $endAt,
            repeatEnabled: $repeatEnabled,
            repeatUnit: $repeatUnit,
            repeatWeeks: $repeatWeeks,
            repeatDays: $repeatDays,
            repeatStartDate: $repeatStartDate,
        );

        DB::transaction(function () use (
            $validated,
            $actor,
            $repeatEnabled,
            $repeatUnit,
            $repeatWeeks,
            $repeatDays,
            $repeatStartDate,
            $seriesId,
            $occurrences,
            &$createdCount,
            &$firstCreatedReservation,
        ) {
            $firstOccurrence = $occurrences[0] ?? null;
            if (! $firstOccurrence) {
                return;
            }

            $minStart = $firstOccurrence['start']->copy();
            $maxEnd = $firstOccurrence['end']->copy();
            foreach ($occurrences as $occ) {
                if ($occ['start']->lt($minStart)) {
                    $minStart = $occ['start']->copy();
                }
                if ($occ['end']->gt($maxEnd)) {
                    $maxEnd = $occ['end']->copy();
                }
            }

            $existing = Reservation::query()
                ->where('meeting_room_id', (int) $validated['meeting_room_id'])
                ->whereIn('status', [ReservationStatus::Approved->value, ReservationStatus::Pending->value])
                ->where('start_at', '<', $maxEnd)
                ->where('end_at', '>', $minStart)
                ->orderBy('start_at')
                ->lockForUpdate()
                ->get(['id', 'start_at', 'end_at', 'status']);

            $conflict = $this->findFirstConflictInMemory($occurrences, $existing);
            if ($conflict) {
                $this->throwConflict($conflict['start'], $conflict['end'], $conflict['conflict']);
            }

            // Bulk insert is significantly faster for large recurring series (hundreds of rows).
            if ($repeatEnabled && count($occurrences) > 1) {
                $now = now();
                $rows = [];
                foreach ($occurrences as $occ) {
                    $rows[] = [
                        'meeting_room_id' => $validated['meeting_room_id'],
                        'requested_by' => $actor?->id,
                        'requester_email' => $validated['email'],
                        'requester_department' => $validated['department'],
                        'requester_attendees' => $validated['attendees'],
                        'approved_by' => null,
                        'title' => $validated['title'],
                        'start_at' => $occ['start'],
                        'end_at' => $occ['end'],
                        'status' => ReservationStatus::Pending->value,
                        'rejected_reason' => null,
                        'repeat_enabled' => true,
                        'repeat_unit' => $repeatUnit,
                        'repeat_weeks' => $repeatWeeks,
                        'repeat_days' => json_encode($repeatDays),
                        'repeat_start_date' => $repeatStartDate?->toDateString(),
                        'repeat_series_id' => $seriesId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                Reservation::query()->insert($rows);
                $createdCount = count($rows);
                $firstCreatedReservation = Reservation::query()
                    ->where('repeat_series_id', $seriesId)
                    ->orderBy('start_at')
                    ->first();

                return;
            }

            foreach ($occurrences as $occ) {
                $payload = [
                    'meeting_room_id' => $validated['meeting_room_id'],
                    'requested_by' => $actor?->id,
                    'requester_email' => $validated['email'],
                    'requester_department' => $validated['department'],
                    'requester_attendees' => $validated['attendees'],
                    'title' => $validated['title'],
                    'start_at' => $occ['start'],
                    'end_at' => $occ['end'],
                    'status' => ReservationStatus::Pending,
                    'repeat_enabled' => (bool) $repeatEnabled,
                    'repeat_unit' => $repeatEnabled ? $repeatUnit : 'week',
                ];

                if ($repeatEnabled) {
                    $payload['repeat_weeks'] = $repeatWeeks;
                    $payload['repeat_days'] = $repeatDays;
                    $payload['repeat_start_date'] = $repeatStartDate?->toDateString();
                    $payload['repeat_series_id'] = $seriesId;
                }

                $firstCreatedReservation ??= Reservation::create($payload);
                $createdCount++;
            }
        });

        if (! $firstCreatedReservation) {
            return response()->json([
                'message' => 'No reservations were created for the selected recurring schedule.',
            ], 422);
        }

        ReservationEvents::record('reservation.created', $firstCreatedReservation);

        $approvers = User::query()
            ->where('is_admin', true)
            ->orWhereJsonContains('access', 'approver')
            ->get(['email']);

        if ($approvers->isNotEmpty()) {
            $fresh = $firstCreatedReservation->fresh(['meetingRoom', 'requester']);
            foreach ($approvers as $approver) {
                Mail::to($approver->email)->queue(new ReservationApprovalRequestMail(
                    $fresh,
                    $approver->email,
                    seriesCount: $createdCount > 1 ? $createdCount : null
                ));
            }
        }

        if ($createdCount === 1) {
            return response()->json($firstCreatedReservation->load(['meetingRoom', 'requester']), 201);
        }

        return response()->json([
            'created' => $createdCount,
            'series_id' => $seriesId,
        ], 201);
    }

    private function paginateUniqueSeries(
        Request $request,
        EloquentBuilder $query,
        string $sortExpr,
        string $sortDir,
        int $perPage,
        int $page,
    ): LengthAwarePaginator {
        // For admin pagination, recurring meetings should show once per series (not per occurrence).
        // Prefer an SQL window-function approach to avoid loading all matching rows into PHP.
        if ($this->supportsWindowFunctions()) {
            try {
                $seriesKeyExpr = "COALESCE(reservations.repeat_series_id, CONCAT('single:', reservations.id))";

                $inner = (clone $query)
                    ->reorder()
                    ->select('reservations.id')
                    ->selectRaw("{$sortExpr} as __sort_key")
                    ->selectRaw("ROW_NUMBER() OVER (PARTITION BY {$seriesKeyExpr} ORDER BY {$sortExpr} {$sortDir}, reservations.id desc) as __rn");

                $outer = DB::query()
                    ->fromSub($inner->toBase(), 't')
                    ->where('__rn', 1)
                    ->orderByRaw("__sort_key {$sortDir}")
                    ->orderBy('id', 'desc');

                $ids = $outer->forPage($page, $perPage)->pluck('id')->all();

                $countQuery = (clone $query)->reorder()->toBase();
                $total = (int) $countQuery
                    ->select(DB::raw("COUNT(DISTINCT {$seriesKeyExpr}) as aggregate"))
                    ->value('aggregate');

                $itemsById = Reservation::query()
                    ->with(['requester:id,name,email', 'approver:id,name,email'])
                    ->whereIn('id', $ids)
                    ->get()
                    ->keyBy('id');

                $items = [];
                foreach ($ids as $id) {
                    if (isset($itemsById[$id])) {
                        $items[] = $itemsById[$id];
                    }
                }

                return new LengthAwarePaginator(
                    $items,
                    $total,
                    $perPage,
                    $page,
                    ['path' => $request->url(), 'query' => $request->query()]
                );
            } catch (\Throwable) {
                // Fall back to the PHP de-duplication path below.
            }
        }

        $all = $query->get();
        $seen = [];
        $unique = [];
        foreach ($all as $r) {
            $seriesId = $r->repeat_series_id ? (string) $r->repeat_series_id : null;
            $key = $seriesId ? "series:{$seriesId}" : "single:{$r->id}";
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $unique[] = $r;
        }

        $total = count($unique);
        $offset = ($page - 1) * $perPage;
        $items = array_slice($unique, $offset, $perPage);

        return new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );
    }

    private function supportsWindowFunctions(): bool
    {
        try {
            $driver = DB::connection()->getDriverName();
            // Laravel typically reports both MySQL and MariaDB as the "mysql" driver.
            if ($driver !== 'mysql') {
                return false;
            }

            $version = (string) DB::connection()->getPdo()->getAttribute(\PDO::ATTR_SERVER_VERSION);
            if (stripos($version, 'mariadb') !== false) {
                if (preg_match('/(\\d+)\\.(\\d+)\\.(\\d+)/', $version, $m)) {
                    [$major, $minor] = [(int) $m[1], (int) $m[2]];
                    return $major > 10 || ($major === 10 && $minor >= 2);
                }

                return false;
            }

            if (preg_match('/(\\d+)\\.(\\d+)\\.(\\d+)/', $version, $m)) {
                [$major, $minor] = [(int) $m[1], (int) $m[2]];
                return $major > 8 || ($major === 8 && $minor >= 0);
            }

            return false;
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @return array<int, array{start: Carbon, end: Carbon}>
     */
    private function buildStoreOccurrences(
        Carbon $startAt,
        Carbon $endAt,
        bool $repeatEnabled,
        ?string $repeatUnit,
        ?int $repeatWeeks,
        array $repeatDays,
        ?Carbon $repeatStartDate,
    ): array {
        if (! $repeatEnabled) {
            return [
                ['start' => $startAt->copy(), 'end' => $endAt->copy()],
            ];
        }

        $repeatUnit = (string) ($repeatUnit ?? 'week');
        $repeatWeeks = (int) ($repeatWeeks ?? 1);
        $repeatStartDate = $repeatStartDate ? $repeatStartDate->copy()->startOfDay() : $startAt->copy()->startOfDay();

        $startTime = [$startAt->hour, $startAt->minute];
        $endTime = [$endAt->hour, $endAt->minute];

        $occurrences = [];

        if ($repeatUnit === 'month') {
            $rangeStart = $repeatStartDate->copy()->startOfDay();
            $rangeEnd = $repeatStartDate->copy()->addMonthsNoOverflow($repeatWeeks)->startOfDay();
            $day = $rangeStart->copy();
            while ($day->lt($rangeEnd)) {
                $iso = (int) $day->isoWeekday();
                if (! in_array($iso, $repeatDays, true)) {
                    $day->addDay();
                    continue;
                }

                $occStart = $day->copy()->setTime($startTime[0], $startTime[1], 0);
                $occEnd = $day->copy()->setTime($endTime[0], $endTime[1], 0);
                if ($occEnd->lte($occStart)) {
                    $occEnd = $occStart->copy()->addHour();
                }

                $occurrences[] = ['start' => $occStart, 'end' => $occEnd];
                $day->addDay();
            }
        } else {
            $repeatStartWeek = $repeatStartDate->copy()->startOfWeek(Carbon::MONDAY);

            for ($weekOffset = 0; $weekOffset < $repeatWeeks; $weekOffset++) {
                $weekStart = $repeatStartWeek->copy()->addWeeks($weekOffset);

                foreach ($repeatDays as $weekday) {
                    $date = $weekStart->copy()->addDays(((int) $weekday) - 1)->startOfDay();
                    if ($date->lt($repeatStartDate)) {
                        continue;
                    }

                    $occStart = $date->copy()->setTime($startTime[0], $startTime[1], 0);
                    $occEnd = $date->copy()->setTime($endTime[0], $endTime[1], 0);
                    if ($occEnd->lte($occStart)) {
                        $occEnd = $occStart->copy()->addHour();
                    }

                    $occurrences[] = ['start' => $occStart, 'end' => $occEnd];
                }
            }
        }

        usort($occurrences, function (array $a, array $b): int {
            $cmp = $a['start']->getTimestamp() <=> $b['start']->getTimestamp();
            if ($cmp !== 0) {
                return $cmp;
            }
            return $a['end']->getTimestamp() <=> $b['end']->getTimestamp();
        });

        return $occurrences;
    }

    /**
     * @param  array<int, array{start: Carbon, end: Carbon}>  $occurrences
     * @return array{start: Carbon, end: Carbon, conflict: Reservation}|null
     */
    private function findFirstConflictInMemory(array $occurrences, $existing): ?array
    {
        if ($existing->isEmpty() || empty($occurrences)) {
            return null;
        }

        $i = 0;
        $existingCount = $existing->count();

        foreach ($occurrences as $occ) {
            $start = $occ['start'];
            $end = $occ['end'];

            while ($i < $existingCount && $existing[$i]->end_at->lte($start)) {
                $i++;
            }

            for ($j = $i; $j < $existingCount; $j++) {
                $r = $existing[$j];
                $rStart = $r->start_at;
                $rEnd = $r->end_at;

                if ($rStart->gte($end)) {
                    break;
                }

                if ($rStart->lt($end) && $rEnd->gt($start)) {
                    return [
                        'start' => $start,
                        'end' => $end,
                        'conflict' => $r,
                    ];
                }
            }
        }

        return null;
    }

    public function show(Request $request, Reservation $reservation)
    {
        return $reservation->load(['meetingRoom', 'requester', 'approver']);
    }

    public function cancel(Request $request, Reservation $reservation)
    {
        $user = $request->user();

        if (! $user->is_admin && $reservation->requested_by !== $user->id) {
            abort(403);
        }

        if (in_array($reservation->status, [ReservationStatus::Cancelled, ReservationStatus::Rejected], true)) {
            return response()->json(['message' => 'Reservation is already closed.'], 422);
        }

        $reservation->status = ReservationStatus::Cancelled;
        $reservation->save();

        ReservationEvents::record('reservation.cancelled', $reservation);

        return response()->json($reservation->load(['meetingRoom', 'requester', 'approver']));
    }

    public function reschedule(Request $request, Reservation $reservation)
    {
        $actor = $request->user();
        abort_unless($actor && ($actor->is_admin || $actor->hasAccess('edit')), 403);

        abort_unless($reservation->status === ReservationStatus::Pending, 422, 'Only pending reservations can be rescheduled.');

        $validated = $request->validate([
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after:start_at'],
        ]);

        $newStartAt = Carbon::parse($validated['start_at']);
        $newEndAt = Carbon::parse($validated['end_at']);
        abort_unless($newStartAt->gte(now()), 422, 'Cannot reserve a meeting in the past.');

        $result = $this->applyReschedule($reservation, $newStartAt, $newEndAt, $actor);

        ReservationEvents::record('reservation.rescheduled', $reservation);

        return response()->json($result);
    }

    public function update(Request $request, Reservation $reservation)
    {
        $actor = $request->user();
        abort_unless($actor && ($actor->is_admin || $actor->hasAccess('edit')), 403);

        abort_unless($reservation->status === ReservationStatus::Pending, 422, 'Only pending reservations can be edited.');

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255'],
            'department' => ['sometimes', 'required', 'string', Rule::in(self::DEPARTMENTS)],
            'attendees' => ['sometimes', 'required', 'integer', 'min:1', 'max:18'],
            'start_at' => ['sometimes', 'required', 'date'],
            'end_at' => ['sometimes', 'required', 'date', 'after:start_at'],
            'repeat' => ['sometimes', 'array'],
            'repeat.enabled' => ['sometimes', 'boolean'],
            'repeat.unit' => ['sometimes', 'string', Rule::in(['week', 'month'])],
            'repeat.weeks' => ['sometimes', 'integer', 'min:1', 'max:52'],
            'repeat.days' => ['sometimes', 'array'],
            'repeat.days.*' => ['integer', 'min:1', 'max:5'],
            'repeat.start_date' => ['sometimes', 'date'],
        ]);

        $newStartAt = array_key_exists('start_at', $validated) ? Carbon::parse($validated['start_at']) : $reservation->start_at;
        $newEndAt = array_key_exists('end_at', $validated) ? Carbon::parse($validated['end_at']) : $reservation->end_at;
        abort_unless($newStartAt->gte(now()), 422, 'Cannot reserve a meeting in the past.');

        $result = $this->applyUpdate($reservation, $validated, $newStartAt, $newEndAt, $actor);

        ReservationEvents::record('reservation.updated', $reservation);

        return response()->json($result);
    }

    private function applyReschedule(Reservation $reservation, Carbon $newStartAt, Carbon $newEndAt, ?User $actor): array
    {
        $seriesId = $reservation->repeat_series_id ? (string) $reservation->repeat_series_id : null;
        if (! $seriesId) {
            $this->assertNoConflict($reservation, $newStartAt, $newEndAt);
            $reservation->start_at = $newStartAt;
            $reservation->end_at = $newEndAt;
            $reservation->save();

            return [
                'reservation' => $reservation->load(['meetingRoom', 'requester', 'approver']),
                'series_updated' => 1,
            ];
        }

        $oldStartAt = $reservation->start_at->copy();
        $oldEndAt = $reservation->end_at->copy();
        $deltaSeconds = (int) ($newStartAt->getTimestamp() - $oldStartAt->getTimestamp());
        $movedDurationSeconds = max(60, (int) ($newEndAt->getTimestamp() - $newStartAt->getTimestamp()));

        $updated = 0;

        DB::transaction(function () use ($reservation, $seriesId, $newStartAt, $newEndAt, $deltaSeconds, $movedDurationSeconds, &$updated, $actor) {
            $this->assertSeriesEditable((string) $seriesId, $reservation->meeting_room_id, $actor);

            $others = Reservation::query()
                ->where('repeat_series_id', $seriesId)
                ->where('meeting_room_id', $reservation->meeting_room_id)
                ->whereIn('status', [ReservationStatus::Pending->value, ReservationStatus::Approved->value])
                ->orderBy('start_at')
                ->lockForUpdate()
                ->get();

            foreach ($others as $r) {
                $start = $r->start_at->copy()->addSeconds($deltaSeconds);
                $end = $start->copy()->addSeconds($movedDurationSeconds);

                // For the one being moved, use the exact provided times (avoids rounding drift).
                if ($r->id === $reservation->id) {
                    $start = $newStartAt->copy();
                    $end = $newEndAt->copy();
                }

                // Keep recurring series within Mon-Fri (kiosk scope).
                $iso = (int) $start->isoWeekday(); // 1..7
                if ($iso < 1 || $iso > 5) {
                    abort(422, 'Recurring reservations must be Monday to Friday.');
                }

                abort_unless($start->gte(now()), 422, 'Cannot reserve a meeting in the past.');
                $this->assertNoConflict($r, $start, $end, excludeSeriesId: (string) $seriesId);

                $r->start_at = $start;
                $r->end_at = $end;
                // Heal inconsistent data: series implies repeat.
                $r->repeat_enabled = true;
                $r->repeat_series_id = $seriesId;
                $r->save();
                $updated++;
            }

            $this->syncSeriesRepeatMeta($seriesId);
        });

        return [
            'reservation' => $reservation->fresh()->load(['meetingRoom', 'requester', 'approver']),
            'series_updated' => $updated,
        ];
    }

    private function applyUpdate(Reservation $reservation, array $validated, Carbon $newStartAt, Carbon $newEndAt, ?User $actor): array
    {
        $currentSeriesId = $reservation->repeat_series_id ? (string) $reservation->repeat_series_id : null;
        $seriesId = $currentSeriesId;

        $repeatChanged = array_key_exists('repeat', $validated);
        $repeatDisabling = false;
        if ($repeatChanged) {
            $repeat = $validated['repeat'] ?? [];
            $enabled = (bool) ($repeat['enabled'] ?? false);
            if (! $enabled) {
                $repeatDisabling = true;
            } else {
                $seriesId = $currentSeriesId ?: (string) Str::uuid();
            }
        }

        // If not part of a series, just update this row.
        if (! $currentSeriesId) {
            $this->assertNoConflict($reservation, $newStartAt, $newEndAt);

            if (array_key_exists('title', $validated)) {
                $reservation->title = $validated['title'];
            }
            if (array_key_exists('email', $validated)) {
                $reservation->requester_email = $validated['email'];
            }
            if (array_key_exists('department', $validated)) {
                $reservation->requester_department = $validated['department'];
            }
            if (array_key_exists('attendees', $validated)) {
                $reservation->requester_attendees = (int) $validated['attendees'];
            }

            if ($repeatChanged) {
                $repeat = $validated['repeat'] ?? [];
                $enabled = (bool) ($repeat['enabled'] ?? false);
                $reservation->repeat_enabled = $enabled;
                if (! $enabled) {
                    $reservation->repeat_unit = 'week';
                    $reservation->repeat_weeks = null;
                    $reservation->repeat_days = null;
                    $reservation->repeat_start_date = null;
                    $reservation->repeat_series_id = null;
                } else {
                    $unit = (string) ($repeat['unit'] ?? 'week');
                    abort_unless(in_array($unit, ['week', 'month'], true), 422, 'Invalid repeat unit.');
                    $weeks = (int) ($repeat['weeks'] ?? 1);
                    if ($unit === 'month' && $weeks > 24) {
                        abort(422, 'Monthly repeats can be at most 24 months.');
                    }
                    $days = array_values(array_unique(array_map('intval', $repeat['days'] ?? [])));
                    sort($days);
                    $reservation->repeat_unit = $unit;
                    $reservation->repeat_weeks = $weeks;
                    $reservation->repeat_days = $days;
                    $reservation->repeat_start_date = Carbon::parse($repeat['start_date'] ?? $newStartAt)->toDateString();
                    $reservation->repeat_series_id = $seriesId ?: (string) Str::uuid();
                }
            }

            $reservation->start_at = $newStartAt;
            $reservation->end_at = $newEndAt;
            $reservation->save();

            return [
                'reservation' => $reservation->load(['meetingRoom', 'requester', 'approver']),
                'series_updated' => 1,
            ];
        }

        $oldStartAt = $reservation->start_at->copy();
        $oldStartDay = $oldStartAt->copy()->startOfDay();
        $newStartDay = $newStartAt->copy()->startOfDay();
        $dayDelta = $newStartDay->diffInDays($oldStartDay, false);
        $durationSeconds = max(60, (int) ($newEndAt->getTimestamp() - $newStartAt->getTimestamp()));
        $newStartTime = [(int) $newStartAt->hour, (int) $newStartAt->minute, (int) $newStartAt->second];
        $newEndTime = [(int) $newEndAt->hour, (int) $newEndAt->minute, (int) $newEndAt->second];
        $updated = 0;

        DB::transaction(function () use (
            $reservation,
            $currentSeriesId,
            $validated,
            $newStartAt,
            $newEndAt,
            $dayDelta,
            $durationSeconds,
            $newStartTime,
            $newEndTime,
            $repeatChanged,
            $repeatDisabling,
            &$updated,
            $actor
        ) {
            $this->assertSeriesEditable((string) $currentSeriesId, $reservation->meeting_room_id, $actor);

            $rows = Reservation::query()
                ->where('repeat_series_id', $currentSeriesId)
                ->where('meeting_room_id', $reservation->meeting_room_id)
                ->whereIn('status', [ReservationStatus::Pending->value, ReservationStatus::Approved->value])
                ->orderBy('start_at')
                ->lockForUpdate()
                ->get();

            foreach ($rows as $r) {
                if (array_key_exists('title', $validated)) {
                    $r->title = $validated['title'];
                }
                if (array_key_exists('email', $validated)) {
                    $r->requester_email = $validated['email'];
                }
                if (array_key_exists('department', $validated)) {
                    $r->requester_department = $validated['department'];
                }
                if (array_key_exists('attendees', $validated)) {
                    $r->requester_attendees = (int) $validated['attendees'];
                }

                if ($repeatChanged) {
                    $repeat = $validated['repeat'] ?? [];
                    $enabled = (bool) ($repeat['enabled'] ?? false);
                    $r->repeat_enabled = $enabled;
                    if (! $enabled) {
                        $r->repeat_unit = 'week';
                        $r->repeat_weeks = null;
                        $r->repeat_days = null;
                        $r->repeat_start_date = null;
                        $r->repeat_series_id = null;
                    } else {
                        $unit = (string) ($repeat['unit'] ?? 'week');
                        abort_unless(in_array($unit, ['week', 'month'], true), 422, 'Invalid repeat unit.');
                        $weeks = (int) ($repeat['weeks'] ?? 1);
                        if ($unit === 'month' && $weeks > 24) {
                            abort(422, 'Monthly repeats can be at most 24 months.');
                        }
                        $days = array_values(array_unique(array_map('intval', $repeat['days'] ?? [])));
                        sort($days);
                        $r->repeat_unit = $unit;
                        $r->repeat_weeks = $weeks;
                        $r->repeat_days = $days;
                        $r->repeat_start_date = Carbon::parse($repeat['start_date'] ?? $newStartAt)->toDateString();
                        $r->repeat_series_id = $currentSeriesId;
                    }
                } else {
                    // Heal inconsistent data: series implies repeat.
                    $r->repeat_enabled = true;
                    $r->repeat_series_id = $currentSeriesId;
                }

                $targetDay = $r->start_at->copy()->startOfDay()->addDays($dayDelta);
                $start = $targetDay->copy()->setTime($newStartTime[0], $newStartTime[1], $newStartTime[2]);
                $end = $targetDay->copy()->setTime($newEndTime[0], $newEndTime[1], $newEndTime[2]);
                if ($end->lte($start)) {
                    $end = $start->copy()->addSeconds($durationSeconds);
                }
                if ($r->id === $reservation->id) {
                    $start = $newStartAt->copy();
                    $end = $newEndAt->copy();
                }

                $iso = (int) $start->isoWeekday();
                if ($iso < 1 || $iso > 5) {
                    abort(422, 'Recurring reservations must be Monday to Friday.');
                }

                abort_unless($start->gte(now()), 422, 'Cannot reserve a meeting in the past.');
                $this->assertNoConflict($r, $start, $end, excludeSeriesId: (string) $currentSeriesId);
                $r->start_at = $start;
                $r->end_at = $end;
                $r->save();
                $updated++;
            }

            if (! $repeatDisabling) {
                $this->syncSeriesRepeatMeta($currentSeriesId);
            }
        });

        return [
            'reservation' => $reservation->fresh()->load(['meetingRoom', 'requester', 'approver']),
            'series_updated' => $updated,
        ];
    }

    private function assertNoConflict(Reservation $reservation, Carbon $startAt, Carbon $endAt, ?string $excludeSeriesId = null): void
    {
        $conflict = $this->findConflict(
            meetingRoomId: (int) $reservation->meeting_room_id,
            startAt: $startAt,
            endAt: $endAt,
            excludeId: (int) $reservation->id,
            excludeSeriesId: $excludeSeriesId
        );
        if ($conflict) {
            $this->throwConflict($startAt, $endAt, $conflict);
        }
    }

    private function findConflict(
        int $meetingRoomId,
        Carbon $startAt,
        Carbon $endAt,
        ?int $excludeId = null,
        ?string $excludeSeriesId = null
    ): ?Reservation {
        $q = Reservation::query()
            ->where('meeting_room_id', $meetingRoomId)
            ->whereIn('status', [ReservationStatus::Approved->value, ReservationStatus::Pending->value])
            ->where('start_at', '<', $endAt)
            ->where('end_at', '>', $startAt);

        if ($excludeId) {
            $q->where('id', '!=', $excludeId);
        }

        if ($excludeSeriesId) {
            $q->where(function ($qq) use ($excludeSeriesId) {
                $qq->whereNull('repeat_series_id')->orWhere('repeat_series_id', '!=', $excludeSeriesId);
            });
        }

        return $q->orderBy('start_at')->first(['id', 'start_at', 'end_at', 'status']);
    }

    private function throwConflict(Carbon $requestedStartAt, Carbon $requestedEndAt, Reservation $conflict): void
    {
        $conflictStart = Carbon::parse($conflict->start_at);
        $conflictEnd = Carbon::parse($conflict->end_at);
        $status = $conflict->status instanceof ReservationStatus ? $conflict->status->value : (string) $conflict->status;

        throw new HttpResponseException(
            response()->json([
                'message' => 'That time slot conflicts with an existing reservation.',
                'requested' => [
                    'start_at' => $requestedStartAt->toISOString(),
                    'end_at' => $requestedEndAt->toISOString(),
                ],
                'conflict' => [
                    'id' => (int) $conflict->id,
                    'status' => $status,
                    'start_at' => $conflictStart->toISOString(),
                    'end_at' => $conflictEnd->toISOString(),
                ],
            ], 422)
        );
    }

    private function assertSeriesEditable(string $seriesId, int $meetingRoomId, ?User $actor): void
    {
        $hasApproved = Reservation::query()
            ->where('repeat_series_id', $seriesId)
            ->where('meeting_room_id', $meetingRoomId)
            ->where('status', ReservationStatus::Approved->value)
            ->exists();

        if (! $hasApproved) {
            return;
        }

        $isApprover = (bool) $actor && ($actor->is_admin || $actor->hasAccess('approver'));
        abort_unless($isApprover, 403, 'Only approvers can change an approved recurring series.');
    }

    private function syncSeriesRepeatMeta(string $seriesId): void
    {
        $rows = Reservation::query()
            ->where('repeat_series_id', $seriesId)
            ->orderBy('start_at')
            ->get(['id', 'start_at']);

        if ($rows->isEmpty()) {
            return;
        }

        $repeatStartDate = Carbon::parse($rows->first()->start_at)->toDateString();
        $repeatDays = [];
        foreach ($rows as $r) {
            $day = (int) Carbon::parse($r->start_at)->isoWeekday();
            if ($day >= 1 && $day <= 5) {
                $repeatDays[$day] = true;
            }
        }

        $days = array_values(array_keys($repeatDays));
        sort($days);

        Reservation::query()
            ->where('repeat_series_id', $seriesId)
            ->update([
                'repeat_enabled' => true,
                'repeat_days' => json_encode($days),
                'repeat_start_date' => $repeatStartDate,
                'updated_at' => now(),
            ]);
    }
}
