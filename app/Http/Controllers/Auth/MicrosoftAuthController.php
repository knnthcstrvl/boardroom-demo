<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\UserEvents;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class MicrosoftAuthController extends Controller
{
    private const ADMIN_EMAILS = [
        'kcavila@mcu.edu.ph',
        'cbmonterey@mcu.edu.ph',
        'oppioquinto@mcu.edu.ph',
        'rrpellazo@mcu.edu.ph',
    ];

    public function redirect(Request $request)
    {
        abort_if(! config('services.microsoft.client_id'), 500, 'Missing MICROSOFT_CLIENT_ID.');
        abort_if(! config('services.microsoft.redirect'), 500, 'Missing MICROSOFT_REDIRECT_URI.');

        $state = Str::random(64);
        $request->session()->put('microsoft_oauth_state', $state);

        $tenant = config('services.microsoft.tenant');
        $authorizeUrl = "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/authorize";

        $query = http_build_query([
            'client_id' => config('services.microsoft.client_id'),
            'response_type' => 'code',
            'redirect_uri' => config('services.microsoft.redirect'),
            'response_mode' => 'query',
            'scope' => implode(' ', config('services.microsoft.scopes', [])),
            'state' => $state,
            'prompt' => 'select_account',
        ]);

        $secureCookie = config('session.secure');
        if ($secureCookie === null) {
            $secureCookie = $request->isSecure();
        }

        return redirect()
            ->away("{$authorizeUrl}?{$query}")
            ->withCookie(cookie(
                name: 'microsoft_oauth_state',
                value: $state,
                minutes: 10,
                path: config('session.path', '/'),
                domain: config('session.domain'),
                secure: (bool) $secureCookie,
                httpOnly: true,
                raw: false,
                sameSite: config('session.same_site', 'lax'),
            ));
    }

    public function callback(Request $request)
    {
        abort_if(! config('services.microsoft.client_id'), 500, 'Missing MICROSOFT_CLIENT_ID.');
        abort_if(! config('services.microsoft.client_secret'), 500, 'Missing MICROSOFT_CLIENT_SECRET.');

        $expectedState = $request->session()->pull('microsoft_oauth_state') ?: $request->cookie('microsoft_oauth_state');
        $providedState = $request->query('state');
        abort_unless($expectedState && hash_equals($expectedState, (string) $providedState), 400, 'Invalid state.');

        $code = (string) $request->query('code');
        abort_if($code === '', 400, 'Missing code.');

        $tenant = config('services.microsoft.tenant');
        $tokenUrl = "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/token";

        $tokenResponse = Http::asForm()->post($tokenUrl, [
            'client_id' => config('services.microsoft.client_id'),
            'client_secret' => config('services.microsoft.client_secret'),
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => config('services.microsoft.redirect'),
            // Ensure the access token includes the requested Graph scopes (not just OIDC scopes).
            'scope' => implode(' ', config('services.microsoft.scopes', [])),
        ]);

        abort_unless($tokenResponse->ok(), 400, 'Token exchange failed.');

        $accessToken = $tokenResponse->json('access_token');
        abort_if(! is_string($accessToken) || $accessToken === '', 400, 'Missing access token.');

        $meResponse = Http::withToken($accessToken)->get('https://graph.microsoft.com/v1.0/me', [
            '$select' => 'id,displayName,mail,userPrincipalName',
        ]);

        abort_unless($meResponse->ok(), 400, 'Unable to fetch user profile.');

        $azureId = (string) $meResponse->json('id');
        $name = (string) $meResponse->json('displayName');
        $email = (string) ($meResponse->json('mail') ?: $meResponse->json('userPrincipalName'));

        abort_if($email === '', 400, 'No email returned by Microsoft.');

        $emailLower = Str::lower($email);

        $allowedDomains = array_filter(array_map('trim', explode(',', (string) config('services.microsoft.allowed_domains'))));
        if (! empty($allowedDomains)) {
            $domain = Str::lower(Str::after($emailLower, '@'));
            abort_unless(in_array($domain, array_map('strtolower', $allowedDomains), true), 403, 'Email domain not allowed.');
        }

        $isFirstUser = User::query()->count() === 0;
        $isAdmin = $isFirstUser || in_array($emailLower, self::ADMIN_EMAILS, true);

        $user = User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => $name !== '' ? $name : $email,
                'azure_id' => $azureId !== '' ? $azureId : null,
                'password' => Str::random(32),
                'is_admin' => $isAdmin,
            ]
        );
        $wasRecentlyCreated = $user->wasRecentlyCreated;

        // Fetch the signed-in user's profile photo using delegated permissions.
        // This does NOT require User.Read.All; it only works for the current user (/me).
        try {
            $photoResponse = Http::withToken($accessToken)
                ->withHeaders(['Accept' => 'image/*'])
                ->timeout(8)
                ->get('https://graph.microsoft.com/v1.0/me/photo/$value');

            if ($photoResponse->ok() && is_string($photoResponse->body()) && $photoResponse->body() !== '') {
                $user->microsoft_avatar_mime = (string) ($photoResponse->header('Content-Type') ?: 'image/jpeg');
                $user->microsoft_avatar_base64 = base64_encode($photoResponse->body());
                $user->save();
            }
        } catch (\Throwable) {
            // ignore avatar errors
        }

        if ($isAdmin) {
            $access = $user->access ?? [];
            $set = array_fill_keys($access, true);
            foreach (['add', 'edit', 'delete'] as $key) {
                $set[$key] = true;
            }
            $user->access = array_values(array_keys($set));
            $user->save();
        }

        if ($wasRecentlyCreated) {
            UserEvents::record('user.created', $user);
        }

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        return redirect()
            ->intended('/kiosk')
            ->withCookie(cookie()->forget('microsoft_oauth_state'));
    }

    public function logout(Request $request)
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
