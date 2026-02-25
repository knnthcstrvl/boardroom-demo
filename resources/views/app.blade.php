<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? 'BoardRoom' }}</title>
    <link rel="icon" type="image/png" href="{{ asset('storage/img/'.rawurlencode('favicon.png')) }}">
    <script>
        window.__AUTH_USER__ = @json($authUser);
        window.__APP_BASE_PATH__ = @json(request()->getBaseUrl());
        window.__BRANDING__ = {
            name: 'BoardRoom',
            logoUrlDark: '{{ asset('storage/img/'.rawurlencode('logo dark.png')) }}',
            logoUrlLight: '{{ asset('storage/img/'.rawurlencode('logo light.png')) }}',
            faviconUrl: '{{ asset('storage/img/'.rawurlencode('favicon.png')) }}',
        };
        // Keep the splash screen visible a bit longer on every page load.
        window.__MIN_BOOT_SPLASH_MS__ = 900;
        window.__BOOT_SPLASH_STARTED_AT__ = Date.now();

        // Apply theme class as early as possible so the Blade splash respects dark mode.
        (function () {
            var basePath = String(window.__APP_BASE_PATH__ || '').replace(/\/+$/, '');
            var currentPath = String((window.location && window.location.pathname) || '');
            if (basePath && (currentPath === basePath || currentPath.indexOf(basePath + '/') === 0)) {
                currentPath = currentPath.slice(basePath.length) || '/';
            }
            var scope = currentPath.indexOf('/admin') === 0 ? 'admin' : 'kiosk';
            var scopedKey = scope === 'admin' ? 'br.theme.admin' : 'br.theme.kiosk';
            var stored = 'system';
            try {
                var v = window.localStorage.getItem(scopedKey);
                if (v !== 'light' && v !== 'dark' && v !== 'system') {
                    var legacy = window.localStorage.getItem('br.theme');
                    if (legacy === 'light' || legacy === 'dark' || legacy === 'system') {
                        v = legacy;
                        try {
                            window.localStorage.setItem(scopedKey, v);
                            // Prevent the legacy key from implicitly affecting other scopes later.
                            window.localStorage.removeItem('br.theme');
                        } catch (e3) {}
                    }
                }
                stored = (v === 'light' || v === 'dark' || v === 'system') ? v : 'system';
            } catch (e) {
                stored = 'system';
            }
            var effective = stored;
            if (stored === 'system') {
                try {
                    effective = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                } catch (e2) {
                    effective = 'light';
                }
            }
            var root = document.documentElement;
            if (!root) return;
            root.classList.toggle('dark', effective === 'dark');
            root.style.colorScheme = effective === 'dark' ? 'dark' : 'light';
        })();
    </script>
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
</head>
<body>
    <div id="app">
        <div class="min-h-screen bg-white px-4 py-6 text-center font-sans dark:bg-slate-950">
            <div class="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center">
                <a href="{{ url('/kiosk') }}" class="flex items-center justify-center gap-3 no-underline hover:opacity-95">
                    <img
                        src="{{ asset('storage/img/'.rawurlencode('logo dark.png')) }}"
                        alt="BoardRoom"
                        class="block h-10 w-auto dark:hidden"
                    >
                    <img
                        src="{{ asset('storage/img/'.rawurlencode('logo light.png')) }}"
                        alt="BoardRoom"
                        class="hidden h-10 w-auto dark:block"
                    >
                    <div class="flex h-10 items-center text-[29px] font-semibold leading-none tracking-tight">
                        <span class="text-brand-primary">Board</span><span class="text-brand-secondary">Room</span>
                    </div>
                </a>

                <div class="mt-5 inline-flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-primary dark:border-slate-700 dark:border-t-brand-secondary"></span>
                    <span>Loading, please wait...</span>
                </div>
            </div>
        </div>
    </div>
    <script>
        window.__APP_BOOTED__ = false;
        window.__APP_MOUNTED__ = false;
        window.__APP_LAST_ERROR__ = null;
        window.addEventListener('error', function (e) {
            window.__APP_LAST_ERROR__ = e && e.error ? String(e.error) : (e && e.message ? String(e.message) : 'Unknown error');
        });
        window.addEventListener('unhandledrejection', function (e) {
            window.__APP_LAST_ERROR__ = e && e.reason ? String(e.reason) : 'Unhandled promise rejection';
        });
        var __brMinSplash = Number(window.__MIN_BOOT_SPLASH_MS__ || 0);
        var __brMountTimeout = Math.max(3500, __brMinSplash + 2500);
        setTimeout(function () {
            if (window.__APP_MOUNTED__) return;
            var el = document.getElementById('app');
            if (!el) return;
            var isDark = !!(document.documentElement && document.documentElement.classList && document.documentElement.classList.contains('dark'));
            var extra = '';
            if (window.__APP_BOOTED__) {
                extra =
                    '<div style="margin-top: 10px; color: ' + (isDark ? '#cbd5e1' : '#4b5563') + '; font-size: 14px; line-height: 1.5;">' +
                    'JS loaded, but the app crashed before mounting. Open DevTools Console for the error.' +
                    (window.__APP_LAST_ERROR__ ? '<div style="margin-top:8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; padding: 10px; background: ' + (isDark ? '#020617' : '#f9fafb') + '; border: 1px solid ' + (isDark ? '#1f2937' : '#e5e7eb') + '; border-radius: 10px; color: ' + (isDark ? '#e2e8f0' : '#111827') + ';">' + window.__APP_LAST_ERROR__ + '</div>' : '') +
                    '</div>';
            }
            el.innerHTML =
                '<div style="font-family: Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; background: ' + (isDark ? '#020617' : '#ffffff') + '; min-height: 100vh;">' +
                '<div style="max-width: 680px; margin: 40px auto; border: 1px solid ' + (isDark ? '#1f2937' : '#e5e7eb') + '; border-radius: 12px; padding: 18px; background: ' + (isDark ? '#0b1220' : '#ffffff') + ';">' +
                '<div style="font-size: 16px; font-weight: 600; color: ' + (isDark ? '#f1f5f9' : '#111827') + ';">Assets not loading</div>' +
                '<div style="margin-top: 8px; color: ' + (isDark ? '#cbd5e1' : '#4b5563') + '; font-size: 14px; line-height: 1.5;">' +
                (window.__APP_BOOTED__
                    ? 'The app did not mount.'
                    : 'The page is stuck on “Loading…” because the Vite JS assets did not load. ') +
                'If you are using <code>npm run build</code>, make sure <code>public/build/manifest.json</code> exists and the JS file returns 200 in the Network tab. ' +
                'If you are using <code>npm run dev</code>, make sure <code>public/hot</code> points to a reachable URL.' +
                '</div>' +
                extra +
                '</div>' +
                '</div>';
        }, __brMountTimeout);
    </script>
</body>
</html>
