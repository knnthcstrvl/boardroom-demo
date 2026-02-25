<?php

namespace Database\Seeders;

use App\Enums\ReservationStatus;
use App\Models\MeetingRoom;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ReservationSeeder extends Seeder
{
    private const TARGET_RESERVATIONS = 500;
    private const MAX_DAYS_TO_TRY = 400;
    private const RECURRING_EVERY = 20;
    private const RECURRING_WEEKS = 8;

    private const DEPARTMENTS = [
        'Information Technology Department',
        'Finance Department',
        'Human Resource Department',
        'Marketing Department',
        'Office of the President',
        'Student Affairs Services',
    ];

    public function run(): void
    {
        $meetingRoom = MeetingRoom::query()
            ->where('is_active', true)
            ->first();

        if (! $meetingRoom) {
            $meetingRoom = MeetingRoom::query()->firstOrCreate([
                'name' => 'Board Room',
            ], [
                'timezone' => config('app.timezone'),
                'is_active' => true,
            ]);
        }

        $meetingRoomId = (int) $meetingRoom->id;
        $seedTimezone = (string) ($meetingRoom->timezone ?: config('app.timezone'));
        if ($seedTimezone === 'UTC' && config('app.timezone') !== 'UTC') {
            $seedTimezone = (string) config('app.timezone');
        }

        $admin = User::query()->where('is_admin', true)->first();
        $requesters = User::query()->where('is_admin', false)->get();

        if ($requesters->isEmpty()) {
            return;
        }

        $nowLocal = now($seedTimezone);
        $rangeStartLocal = $nowLocal->copy()->startOfMonth()->startOfDay();

        // Available hours: 7:00am to 7:00pm (end_at must be <= 19:00).
        $slots = [
            ['hour' => 7, 'minute' => 0, 'minutes' => 60],
            ['hour' => 9, 'minute' => 0, 'minutes' => 90],
            ['hour' => 12, 'minute' => 0, 'minutes' => 60],
            ['hour' => 14, 'minute' => 30, 'minutes' => 60],
            ['hour' => 17, 'minute' => 0, 'minutes' => 90],
        ];

        $created = 0;

        $dayLocal = $rangeStartLocal->copy();
        $daysTried = 0;

        while ($created < self::TARGET_RESERVATIONS && $daysTried < self::MAX_DAYS_TO_TRY) {
            $dayOffset = $rangeStartLocal->diffInDays($dayLocal);

            foreach ($slots as $index => $slot) {
                if ($created >= self::TARGET_RESERVATIONS) {
                    break;
                }

                $startAtLocal = $dayLocal->copy()->setTime($slot['hour'], $slot['minute'], 0);
                $endAtLocal = $startAtLocal->copy()->addMinutes($slot['minutes']);

                if ($startAtLocal->hour < 7) {
                    continue;
                }

                if ($endAtLocal->hour > 19 || ($endAtLocal->hour === 19 && $endAtLocal->minute > 0)) {
                    continue;
                }

                $startAt = $startAtLocal->copy()->setTimezone(config('app.timezone'));
                $endAt = $endAtLocal->copy()->setTimezone(config('app.timezone'));

                $requester = $requesters[$created % $requesters->count()];
                $department = self::DEPARTMENTS[$created % count(self::DEPARTMENTS)];
                $attendees = ($created % 18) + 1;

                $status = match (($dayOffset + $index) % 4) {
                    0 => ReservationStatus::Approved,
                    1 => ReservationStatus::Pending,
                    2 => ReservationStatus::Rejected,
                    default => ReservationStatus::Cancelled,
                };

                $approvedBy = in_array($status, [ReservationStatus::Approved, ReservationStatus::Rejected], true)
                    ? $admin?->id
                    : null;

                $rejectedReason = $status === ReservationStatus::Rejected
                    ? 'Scheduling conflict with another team.'
                    : null;

                $repeatDay = (int) $startAtLocal->isoWeekday();
                $shouldAttemptRecurring = $repeatDay <= 5 && (($created % self::RECURRING_EVERY) === 0);

                if ($shouldAttemptRecurring) {
                    $seriesStartLocal = $dayLocal->copy()->startOfDay();
                    $todayLocal = $nowLocal->copy()->startOfDay();
                    if ($seriesStartLocal->lt($todayLocal)) {
                        $seriesStartLocal = $todayLocal;
                    }

                    $firstOccDayLocal = $seriesStartLocal->copy();
                    while ((int) $firstOccDayLocal->isoWeekday() !== $repeatDay) {
                        $firstOccDayLocal->addDay();
                    }

                    $seriesId = (string) Str::uuid();
                    $repeatWeeks = self::RECURRING_WEEKS;
                    $repeatDays = [$repeatDay];
                    $repeatStartDate = $firstOccDayLocal->toDateString();

                    $canCreateSeries = true;
                    for ($i = 0; $i < 2; $i++) {
                        $occStartLocal = $firstOccDayLocal->copy()->addWeeks($i)->setTime($slot['hour'], $slot['minute'], 0);
                        $occEndLocal = $occStartLocal->copy()->addMinutes($slot['minutes']);

                        $occStart = $occStartLocal->copy()->setTimezone(config('app.timezone'));
                        $occEnd = $occEndLocal->copy()->setTimezone(config('app.timezone'));

                        $exists = Reservation::query()
                            ->where('meeting_room_id', $meetingRoomId)
                            ->where('start_at', $occStart)
                            ->where('end_at', $occEnd)
                            ->exists();

                        if ($exists) {
                            $canCreateSeries = false;
                            break;
                        }
                    }

                    if ($canCreateSeries) {
                        for ($weekOffset = 0; $weekOffset < $repeatWeeks; $weekOffset++) {
                            if ($created >= self::TARGET_RESERVATIONS) {
                                break;
                            }

                            $occStartLocal = $firstOccDayLocal->copy()->addWeeks($weekOffset)->setTime($slot['hour'], $slot['minute'], 0);
                            $occEndLocal = $occStartLocal->copy()->addMinutes($slot['minutes']);

                            $occStart = $occStartLocal->copy()->setTimezone(config('app.timezone'));
                            $occEnd = $occEndLocal->copy()->setTimezone(config('app.timezone'));

                            $exists = Reservation::query()
                                ->where('meeting_room_id', $meetingRoomId)
                                ->where('start_at', $occStart)
                                ->where('end_at', $occEnd)
                                ->exists();

                            if ($exists) {
                                continue;
                            }

                            Reservation::query()->create([
                                'meeting_room_id' => $meetingRoomId,
                                'requested_by' => $requester->id,
                                'requester_email' => $requester->email,
                                'requester_department' => $department,
                                'requester_attendees' => $attendees,
                                'approved_by' => null,
                                'title' => sprintf('Recurring Team Sync (%s)', $occStartLocal->format('D')),
                                'start_at' => $occStart,
                                'end_at' => $occEnd,
                                'status' => ReservationStatus::Pending,
                                'rejected_reason' => null,
                                'repeat_enabled' => true,
                                'repeat_unit' => 'week',
                                'repeat_weeks' => $repeatWeeks,
                                'repeat_days' => $repeatDays,
                                'repeat_start_date' => $repeatStartDate,
                                'repeat_series_id' => $seriesId,
                            ]);

                            $created++;
                        }

                        continue;
                    }
                }

                $exists = Reservation::query()
                    ->where('meeting_room_id', $meetingRoomId)
                    ->where('start_at', $startAt)
                    ->where('end_at', $endAt)
                    ->exists();

                if ($exists) {
                    continue;
                }

                Reservation::query()->create([
                    'meeting_room_id' => $meetingRoomId,
                    'requested_by' => $requester->id,
                    'requester_email' => $requester->email,
                    'requester_department' => $department,
                    'requester_attendees' => $attendees,
                    'approved_by' => $approvedBy,
                    'title' => sprintf('Team Sync (%s)', $startAtLocal->format('D')),
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'status' => $status,
                    'rejected_reason' => $rejectedReason,
                    'repeat_enabled' => false,
                    'repeat_unit' => 'week',
                ]);

                $created++;
            }

            $dayLocal->addDay();
            $daysTried++;
        }
    }
}
