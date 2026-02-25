<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class UserAvatarController extends Controller
{
    public function __invoke(Request $request, User $user)
    {
        $actor = $request->user();
        abort_if(! $actor, 401);
        abort_unless($actor->is_admin || $actor->hasAnyAccess(['add', 'edit', 'delete']), 403);

        $initials = $this->initials($user->name ?: $user->email);

        if ($user->microsoft_avatar_base64) {
            $mime = $user->microsoft_avatar_mime ?: 'image/jpeg';
            $decoded = base64_decode((string) $user->microsoft_avatar_base64, true);
            if (is_string($decoded) && $decoded !== '') {
                return response($decoded, 200, [
                    'Content-Type' => $mime,
                    'Cache-Control' => 'private, max-age=3600',
                ]);
            }
        }

        $azureId = $user->azure_id ? (string) $user->azure_id : null;
        if (! $azureId) {
            return $this->svgAvatar($initials);
        }

        $cacheDir = storage_path('app/user-avatars');
        File::ensureDirectoryExists($cacheDir);
        $cachePath = $cacheDir.DIRECTORY_SEPARATOR.$azureId.'.jpg';
        $maxAgeSeconds = 60 * 60 * 24; // 24h

        if (File::exists($cachePath)) {
            $age = time() - (int) File::lastModified($cachePath);
            if ($age >= 0 && $age < $maxAgeSeconds) {
                return response()->file($cachePath, [
                    'Content-Type' => 'image/jpeg',
                    'Cache-Control' => 'private, max-age=3600',
                ]);
            }
        }

        $token = $this->graphAppToken();
        if (! $token) {
            return $this->svgAvatar($initials);
        }

        $photo = Http::withToken($token)
            ->withHeaders(['Accept' => 'image/*'])
            ->timeout(8)
            ->get("https://graph.microsoft.com/v1.0/users/{$azureId}/photo/\$value");

        if ($photo->status() === 404) {
            return $this->svgAvatar($initials);
        }

        if (! $photo->ok()) {
            return $this->svgAvatar($initials);
        }

        $contentType = (string) ($photo->header('Content-Type') ?: 'image/jpeg');
        $body = $photo->body();
        if (! is_string($body) || $body === '') {
            return $this->svgAvatar($initials);
        }

        File::put($cachePath, $body);

        return response($body, 200, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    private function graphAppToken(): ?string
    {
        $tenant = (string) config('services.microsoft.tenant');
        $clientId = (string) config('services.microsoft.client_id');
        $clientSecret = (string) config('services.microsoft.client_secret');
        if ($tenant === '' || $clientId === '' || $clientSecret === '') {
            return null;
        }

        $tokenUrl = "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/token";

        try {
            $resp = Http::asForm()->timeout(8)->post($tokenUrl, [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'grant_type' => 'client_credentials',
                'scope' => 'https://graph.microsoft.com/.default',
            ]);
        } catch (\Throwable) {
            return null;
        }

        if (! $resp->ok()) {
            return null;
        }

        $token = $resp->json('access_token');

        return is_string($token) && $token !== '' ? $token : null;
    }

    private function initials(string $s): string
    {
        $s = trim($s);
        if ($s === '') {
            return 'U';
        }

        $parts = preg_split('/\s+/', $s) ?: [];
        $first = $parts[0] ?? '';
        $last = $parts[count($parts) - 1] ?? '';

        $a = $first !== '' ? Str::upper(Str::substr($first, 0, 1)) : '';
        $b = $last !== '' ? Str::upper(Str::substr($last, 0, 1)) : '';
        $out = $a.$b;
        $out = trim($out);

        return $out !== '' ? $out : 'U';
    }

    private function svgAvatar(string $initials)
    {
        $initials = e(Str::upper(Str::substr($initials, 0, 2)));
        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="32" fill="#E2D8E7"/>
  <text x="32" y="32" dy="0.35em" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-size="24" font-weight="700" fill="#5c297c">{$initials}</text>
</svg>
SVG;

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml; charset=utf-8',
            // Avoid long-lived caching so style tweaks reflect immediately.
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }
}
