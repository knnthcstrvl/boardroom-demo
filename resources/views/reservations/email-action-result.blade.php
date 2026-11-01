<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }} - BoardRoom</title>
</head>
<body style="font-family: Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #f8fafc; margin: 0;">
    <div style="max-width: 720px; margin: 48px auto; padding: 0 16px;">
        <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px;">
            <h1 style="margin: 0; font-size: 18px;">{{ $title }}</h1>
            <p style="margin: 10px 0 0; color: #475569;">{{ $message }}</p>
            <p style="margin: 16px 0 0;">
                <a href="{{ url('/kiosk') }}" style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 10px;">
                    Open BoardRoom Kiosk
                </a>
            </p>
        </div>
    </div>
</body>
</html>
