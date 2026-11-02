<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'microsoft' => [
        'tenant' => env('MICROSOFT_TENANT_ID', 'common'),
        'client_id' => env('MICROSOFT_CLIENT_ID'),
        'client_secret' => env('MICROSOFT_CLIENT_SECRET'),
        'redirect' => env('MICROSOFT_REDIRECT_URI', env('APP_URL').'/auth/microsoft/callback'),
        'allowed_domains' => env('MICROSOFT_ALLOWED_DOMAINS', ''),
        'scopes' => [
            'openid',
            'profile',
            'email',
            'offline_access',
            'User.Read',
        ],
    ],

    'demo' => [
        // Make the demo sign-in visible on production demo deployments by default.
        // Set DEMO_ADMIN_LOGIN_ENABLED=false explicitly to keep it disabled.
        'admin_login_enabled' => filter_var(
            env('DEMO_ADMIN_LOGIN_ENABLED', env('APP_ENV') === 'production'),
            FILTER_VALIDATE_BOOLEAN
        ),
        'admin_email' => env('DEMO_ADMIN_EMAIL', 'admin@example.com'),
    ],

];
