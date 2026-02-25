<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\UserEvents;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const ADMIN_DEFAULT_ACCESS = ['add', 'edit', 'delete'];

    public function index(Request $request)
    {
        $this->authorizeAction($request->user(), 'index');

        $validated = $request->validate([
            'q' => ['sometimes', 'string', 'max:200'],
            'role' => ['sometimes', 'string', Rule::in(['admin', 'user'])],
            'access_any' => ['sometimes', 'array'],
            'access_any.*' => ['string', Rule::in(['approver', 'view', 'add', 'edit', 'delete'])],
            'sort_by' => ['sometimes', 'string', Rule::in(['created_at', 'name', 'email', 'role', 'access'])],
            'sort_dir' => ['sometimes', 'string', Rule::in(['asc', 'desc'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::query()->select(['id', 'name', 'email', 'azure_id', 'is_admin', 'access', 'created_at', 'updated_at']);

        if (! empty($validated['q'])) {
            $term = trim((string) $validated['q']);
            if ($term !== '') {
                $query->where(function (Builder $q) use ($term) {
                    $q->where('name', 'like', "%{$term}%")
                        ->orWhere('email', 'like', "%{$term}%");
                });
            }
        }

        if (! empty($validated['role'])) {
            $query->where('is_admin', $validated['role'] === 'admin');
        }

        if (! empty($validated['access_any'])) {
            $accessAny = array_values(array_unique($validated['access_any']));
            $query->where(function (Builder $q) use ($accessAny) {
                foreach ($accessAny as $access) {
                    $q->orWhereJsonContains('access', $access);
                }
            });
        }

        $sortBy = (string) ($validated['sort_by'] ?? 'created_at');
        $sortDir = (string) ($validated['sort_dir'] ?? 'desc');

        if ($sortBy === 'role') {
            $query->orderBy('is_admin', $sortDir)->orderBy('id', 'desc');
        } elseif ($sortBy === 'access') {
            $query
                ->orderBy(DB::raw('COALESCE(JSON_LENGTH(access), 0)'), $sortDir)
                ->orderBy('id', 'desc');
        } else {
            $query->orderBy($sortBy, $sortDir)->orderBy('id', 'desc');
        }

        $perPage = (int) ($validated['per_page'] ?? 10);

        return $query->paginate($perPage);
    }

    public function store(Request $request)
    {
        $actor = $request->user();
        $this->authorizeAction($actor, 'store');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'is_admin' => ['sometimes', 'boolean'],
            'access' => ['sometimes', 'array'],
            'access.*' => ['string', Rule::in(['approver', 'view', 'add', 'edit', 'delete'])],
        ]);

        $isAdmin = (bool) ($validated['is_admin'] ?? false);
        if (! $actor->is_admin) {
            $isAdmin = false;
        }
        $access = $validated['access'] ?? [];
        if ($isAdmin) {
            $set = array_fill_keys($access, true);
            foreach (self::ADMIN_DEFAULT_ACCESS as $key) {
                $set[$key] = true;
            }
            $access = array_values(array_keys($set));
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => str()->random(32),
            'is_admin' => $isAdmin,
            'access' => $access,
        ]);

        UserEvents::record('user.created', $user);

        return response()->json($user->only(['id', 'name', 'email', 'azure_id', 'is_admin', 'access']), 201);
    }

    public function show(Request $request, User $user)
    {
        $this->authorizeAction($request->user(), 'show');

        return response()->json($user->only(['id', 'name', 'email', 'azure_id', 'is_admin', 'access']));
    }

    public function update(Request $request, User $user)
    {
        $actor = $request->user();
        $this->authorizeAction($actor, 'update');

        abort_if($user->is_admin && ! $actor->is_admin, 403);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'is_admin' => ['sometimes', 'boolean'],
            'access' => ['sometimes', 'array'],
            'access.*' => ['string', Rule::in(['approver', 'view', 'add', 'edit', 'delete'])],
        ]);

        if (! $actor->is_admin) {
            unset($validated['is_admin']);
        }

        $user->fill($validated);

        if ($user->is_admin) {
            $access = array_key_exists('access', $validated) ? ($validated['access'] ?? []) : ($user->access ?? []);
            $set = array_fill_keys($access, true);
            foreach (self::ADMIN_DEFAULT_ACCESS as $key) {
                $set[$key] = true;
            }
            $user->access = array_values(array_keys($set));
        }

        $user->save();

        UserEvents::record('user.updated', $user);

        return response()->json($user->only(['id', 'name', 'email', 'azure_id', 'is_admin', 'access']));
    }

    public function destroy(Request $request, User $user)
    {
        $actor = $request->user();
        $this->authorizeAction($actor, 'destroy');

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot delete yourself.'], 422);
        }

        abort_if($user->is_admin && ! $actor->is_admin, 403);

        UserEvents::record('user.deleted', $user);

        $user->delete();

        return response()->noContent();
    }

    private function authorizeAction(User $actor, string $action): void
    {
        if ($actor->is_admin) {
            return;
        }

        $can = match ($action) {
            'store' => $actor->hasAccess('add'),
            'update' => $actor->hasAccess('edit'),
            'destroy' => $actor->hasAccess('delete'),
            default => $actor->hasAnyAccess(['add', 'edit', 'delete']),
        };

        abort_unless($can, 403);
    }
}
