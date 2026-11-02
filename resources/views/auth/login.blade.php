<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>BoardRoom | Login</title>
    <script>
        window.__AUTH_USER__ = null;
        window.__DEMO_ADMIN_LOGIN_ENABLED__ = @json((bool) config('services.demo.admin_login_enabled'));
        window.__APP_BASE_PATH__ = @json(request()->getBaseUrl());
        window.__BRANDING__ = {
            name: 'BoardRoom',
        };
    </script>
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
</head>
<body>
    <div id="app">
        <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
            <div class="min-h-screen flex items-center justify-center px-4">
                <div class="w-full max-w-md rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    <a href="{{ url('/kiosk') }}" class="flex items-center gap-3 no-underline hover:opacity-95">
                        <div class="h-10 flex items-center text-[29px] leading-none font-semibold tracking-tight">
                            <span class="text-brand-primary">Board</span><span class="text-brand-secondary">Room</span>
                        </div>
                    </a>
                    <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Sign in with your Microsoft account to access the admin panel.</p>

                    <a
                        href="{{ route('auth.microsoft.redirect') }}"
                        class="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-primary/90 dark:bg-brand-secondary dark:text-slate-900 dark:hover:bg-brand-secondary/90"
                    >
                        Sign in with Microsoft
                    </a>

                    @if (config('services.demo.admin_login_enabled'))
                        <div class="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                            <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
                            Demo access
                            <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
                        </div>
                        <form method="POST" action="{{ route('auth.demo-admin') }}">
                            @csrf
                            <button type="submit" class="inline-flex w-full items-center justify-center rounded-lg border border-brand-primary/30 bg-white px-4 py-2.5 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 dark:border-brand-secondary/40 dark:bg-slate-900 dark:text-brand-secondary dark:hover:bg-slate-800">
                                Continue as demo admin
                            </button>
                        </form>
                    @endif
                </div>
            </div>
        </div>
    </div>
    <script>
        window.__APP_MOUNTED__ = false;
        setTimeout(function () {
            if (window.__APP_MOUNTED__) return;
            // Keep the Blade fallback content.
        }, 1500);
    </script>
</body>
</html>
