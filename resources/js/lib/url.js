function normalizeBasePath(value) {
  const raw = String(value || "").trim()
  if (!raw || raw === "/") return ""
  const trimmed = raw.replace(/\/+$/, "")
  if (!trimmed) return ""
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

export function getBasePath() {
  if (typeof window === "undefined") return ""
  return normalizeBasePath(window.__APP_BASE_PATH__)
}

export function withBasePath(path) {
  const value = String(path || "")
  if (!value) return getBasePath() || "/"
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) return value
  if (!value.startsWith("/")) return value

  const base = getBasePath()
  if (!base) return value
  if (value === base || value.startsWith(`${base}/`)) return value
  return `${base}${value}`
}

export function stripBasePath(pathname) {
  const value = String(pathname || "")
  const base = getBasePath()
  if (!base) return value || "/"
  if (value === base) return "/"
  if (value.startsWith(`${base}/`)) return value.slice(base.length) || "/"
  return value || "/"
}

