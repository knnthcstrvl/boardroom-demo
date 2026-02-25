import { stripBasePath } from "./url"

const STORAGE_KEY_LEGACY = "br.theme" // "light" | "dark" | "system"
const STORAGE_KEYS = {
  kiosk: "br.theme.kiosk",
  admin: "br.theme.admin",
}

let activeScope = null // "kiosk" | "admin"

function safeMatchMedia(query) {
  try {
    return window.matchMedia ? window.matchMedia(query) : null
  } catch {
    return null
  }
}

export function getThemeScope(pathname) {
  const p = stripBasePath(String((pathname ?? (typeof window !== "undefined" ? window.location.pathname : "")) || ""))
  return p.startsWith("/admin") ? "admin" : "kiosk"
}

function normalizeScope(scope) {
  const s = scope === "admin" || scope === "kiosk" ? scope : getThemeScope()
  return s
}

function getStorageKey(scope) {
  return STORAGE_KEYS[normalizeScope(scope)] || STORAGE_KEY_LEGACY
}

function readRawTheme(key) {
  try {
    const v = window.localStorage.getItem(key)
    return v === "light" || v === "dark" || v === "system" ? v : null
  } catch {
    return null
  }
}

function migrateLegacyTheme(scope) {
  const scopedKey = getStorageKey(scope)
  const already = readRawTheme(scopedKey)
  if (already) return already
  const legacy = readRawTheme(STORAGE_KEY_LEGACY)
  if (!legacy) return null
  try {
    window.localStorage.setItem(scopedKey, legacy)
    // Prevent the legacy key from implicitly affecting other scopes later.
    window.localStorage.removeItem(STORAGE_KEY_LEGACY)
  } catch {
    // ignore
  }
  return legacy
}

export function getStoredTheme(scope) {
  try {
    const key = getStorageKey(scope)
    const migrated = migrateLegacyTheme(scope)
    const v = migrated || readRawTheme(key)
    return v === "light" || v === "dark" || v === "system" ? v : "system"
  } catch {
    return "system"
  }
}

export function getEffectiveTheme(stored = getStoredTheme()) {
  if (stored === "light" || stored === "dark") return stored
  const mql = safeMatchMedia("(prefers-color-scheme: dark)")
  return mql && mql.matches ? "dark" : "light"
}

export function applyThemeClass(effectiveTheme) {
  const root = document.documentElement
  if (!root) return
  root.classList.toggle("dark", effectiveTheme === "dark")
  root.style.colorScheme = effectiveTheme === "dark" ? "dark" : "light"
}

export function setTheme(next, scope) {
  const s = normalizeScope(scope)
  const value = next === "light" || next === "dark" || next === "system" ? next : "system"
  try {
    window.localStorage.setItem(getStorageKey(s), value)
  } catch {
    // ignore
  }
  const effective = getEffectiveTheme(value)
  if (activeScope === s) {
    applyThemeClass(effective)
  }
  window.dispatchEvent(new CustomEvent("br.theme.changed", { detail: { scope: s, stored: value, effective } }))
}

let mqlAttached = false
export function initTheme(scope) {
  const s = normalizeScope(scope)
  activeScope = s
  const stored = getStoredTheme(s)
  applyThemeClass(getEffectiveTheme(stored))

  const mql = safeMatchMedia("(prefers-color-scheme: dark)")
  if (!mql) return
  const onChange = () => {
    const currentScope = activeScope || getThemeScope()
    const current = getStoredTheme(currentScope)
    if (current !== "system") return
    const effective = getEffectiveTheme(current)
    applyThemeClass(effective)
    window.dispatchEvent(new CustomEvent("br.theme.changed", { detail: { scope: currentScope, stored: current, effective } }))
  }
  if (mqlAttached) return
  mqlAttached = true
  if (typeof mql.addEventListener === "function") mql.addEventListener("change", onChange)
  else if (typeof mql.addListener === "function") mql.addListener(onChange)
}
