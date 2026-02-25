import axios from "axios"
import { getBasePath, withBasePath } from "./url"

export function initHttp() {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
  if (token) setCsrfToken(token)
  axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest"

  if (!axios.__boardroom_interceptors_installed) {
    axios.__boardroom_interceptors_installed = true

    let refreshing = null

    axios.interceptors.request.use((config) => {
      const url = config?.url
      if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return config

      const base = getBasePath()
      if (base && (url === base || url.startsWith(`${base}/`))) return config

      config.url = withBasePath(url)
      return config
    })

    async function refreshCsrfToken() {
      if (refreshing) return refreshing
      refreshing = (async () => {
        const res = await axios.get("/api/csrf", { headers: { "X-Requested-With": "XMLHttpRequest" } })
        const next = res?.data?.csrf_token
        if (!next) throw new Error("Missing csrf_token")
        setCsrfToken(next)
        return next
      })()
      try {
        return await refreshing
      } finally {
        refreshing = null
      }
    }

    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status
        const config = error?.config
        if (!config) throw error

        // Laravel CSRF token mismatch is commonly 419.
        if (status === 419 && !config.__csrfRetried) {
          config.__csrfRetried = true
          try {
            await refreshCsrfToken()
            return axios(config)
          } catch {
            // As a last resort for long-running kiosk tablets, reload the page.
            window.location.reload()
          }
        }

        throw error
      }
    )

    // Keep long-running kiosk tablets from hitting CSRF/session expiry.
    window.setInterval(() => {
      refreshCsrfToken().catch(() => {})
    }, 15 * 60 * 1000)
  }
}

function setCsrfToken(token) {
  axios.defaults.headers.common["X-CSRF-TOKEN"] = token
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta) meta.setAttribute("content", token)
}

export default axios
