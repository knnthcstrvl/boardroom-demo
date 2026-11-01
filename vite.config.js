import fs from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')

    const devHost = env.VITE_DEV_HOST || 'boardroom.test'
    const devPort = Number(env.VITE_DEV_PORT || 5173)

    const certPath = env.VITE_HTTPS_CERT_PATH
    const keyPath = env.VITE_HTTPS_KEY_PATH
    const useHttps = Boolean(certPath && keyPath)

    const https = useHttps
        ? {
              cert: fs.readFileSync(certPath),
              key: fs.readFileSync(keyPath),
          }
        : undefined

    const origin =
        env.VITE_DEV_ORIGIN ||
        `${useHttps ? 'https' : 'http'}://${devHost}:${devPort}`

    return {
        // The app is served from the web root in local development (for example,
        // `php artisan serve` at http://127.0.0.1:8000).
        base: '/',

        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.jsx'],
                refresh: true,
            }),
            react(),
        ],

        server: {
            host: true,
            port: devPort,
            strictPort: true,
            https,
            origin,
            cors: { origin: true },
            hmr: {
                host: devHost,
                protocol: useHttps ? 'wss' : 'ws',
            },
        },
    }
})
