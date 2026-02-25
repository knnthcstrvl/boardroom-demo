import React, { useEffect, useRef, useState } from "react"
import axios from "../lib/http"
import { createReservationStream } from "../lib/reservationStream"
import { getPermissions } from "../lib/permissions"
import NotificationPopover from "../components/NotificationPopover"
import { getStoredTheme, getEffectiveTheme, setTheme } from "../lib/theme"
import AdminSidebar from "../components/admin/AdminSidebar"
import { AdminSearchProvider, useAdminSearch } from "../lib/adminSearch"

function SearchIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M11 19a8 8 0 1 1 0-16a8 8 0 0 1 0 16Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M21 21l-4.35-4.35"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SunIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 18a6 6 0 1 0 0-12a6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ThemeToggle() {
  const scope = "admin"
  const [stored, setStored] = useState(getStoredTheme(scope))
  const [effective, setEffective] = useState(getEffectiveTheme(stored))

  useEffect(() => {
    function onChanged(e) {
      const eventScope = e?.detail?.scope
      if (eventScope && eventScope !== scope) return
      const nextStored = e?.detail?.stored || getStoredTheme(scope)
      const nextEffective = e?.detail?.effective || getEffectiveTheme(nextStored)
      setStored(nextStored)
      setEffective(nextEffective)
    }
    window.addEventListener("br.theme.changed", onChanged)
    return () => window.removeEventListener("br.theme.changed", onChanged)
  }, [])

  const isDark = effective === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark", scope)}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  )
}

function AdminTopbar({ perms, pendingCount, notifLoading, notifItems, onNotifOpenChange, onNotifAction }) {
  const { query, setQuery } = useAdminSearch()

  return (
    <div className="sticky top-0 z-30 mb-4 bg-slate-50 px-4 pt-4 dark:bg-slate-950">
      <div className="flex h-14 items-center gap-2 rounded-none bg-slate-50 px-3 border-b border-slate-200 dark:bg-slate-950 dark:border-slate-800">
        <SearchIcon className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          aria-label="Search"
          className="h-full w-full flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
        />

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {perms.canReservations ? (
            <NotificationPopover
              count={pendingCount}
              loading={notifLoading}
              items={notifItems}
              onOpenChange={onNotifOpenChange}
              onAction={onNotifAction}
            />
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout({ user, path, onLogout, children }) {
  const brand = window.__BRANDING__ || { name: "BoardRoom", logoUrlDark: "", logoUrlLight: "" }
  const [pendingCount, setPendingCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifItems, setNotifItems] = useState([])
  const perms = getPermissions(user)
  const notifLoadInFlightRef = useRef(false)
  const notifOpenRef = useRef(false)

  async function loadStats() {
    if (!perms.canReservations) return
    try {
      const { data } = await axios.get("/api/reservations/stats")
      if (data && typeof data === "object" && !Array.isArray(data) && Number.isFinite(Number(data.pending))) {
        setPendingCount(Number(data.pending))
        return
      }
      throw new Error("Unexpected stats response")
    } catch {
      try {
        const { data } = await axios.get("/api/reservations", { params: { status: ["pending"] } })
        if (Array.isArray(data)) {
          const keys = new Set(
            data.map((r) => (r && r.repeat_series_id ? `series:${r.repeat_series_id}` : r ? `single:${r.id}` : ""))
          )
          keys.delete("")
          setPendingCount(keys.size)
        } else {
          setPendingCount(0)
        }
      } catch {
        // ignore
      }
    }
  }

  function dedupeSeries(list) {
    const map = new Map()
    for (const r of list || []) {
      if (!r?.id) continue
      const key = r.repeat_series_id ? `series:${r.repeat_series_id}` : `single:${r.id}`
      if (!map.has(key)) map.set(key, r)
    }
    return Array.from(map.values())
  }

  async function loadNotifications() {
    if (!perms.canReservations) return
    if (notifLoadInFlightRef.current) return
    notifLoadInFlightRef.current = true
    setNotifLoading(true)
    try {
      const { data } = await axios.get("/api/reservations", {
        params: {
          status: ["pending"],
          per_page: 12,
          sort_by: "created_at",
          sort_dir: "desc",
        },
      })
      const list = dedupeSeries(data?.data || [])
      setNotifItems(list.slice(0, 8))
    } catch {
      setNotifItems([])
    } finally {
      setNotifLoading(false)
      notifLoadInFlightRef.current = false
    }
  }

  function goToReservationConfirm(action, reservation) {
    const id = reservation?.id
    if (!id) return
    const next = `/admin/reservations?confirm=${encodeURIComponent(action)}&reservation=${encodeURIComponent(String(id))}`
    window.location.assign(next)
  }

  useEffect(() => {
    notifOpenRef.current = Boolean(notifOpen)
  }, [notifOpen])

  useEffect(() => {
    if (!perms.canReservations) return
    loadStats()

    let refreshTimer = null
    function scheduleRefresh() {
      if (refreshTimer) return
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        loadStats()
        if (notifOpenRef.current) loadNotifications()
      }, 300)
    }

    const stream = createReservationStream()
    stream.addEventListener("reservation.changed", scheduleRefresh)

    const id = window.setInterval(loadStats, 30000)

    return () => {
      stream.close()
      if (refreshTimer) window.clearTimeout(refreshTimer)
      window.clearInterval(id)
    }
  }, [perms.canReservations])

  useEffect(() => {
    if (!notifOpen) return
    loadNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen])

  return (
    <AdminSearchProvider>
      <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        <div className="flex h-full w-full">
          <AdminSidebar brand={brand} user={user} path={path} perms={perms} pendingCount={pendingCount} onLogout={onLogout} />

          <main className="min-w-0 flex-1 overflow-y-auto">
            <AdminTopbar
              perms={perms}
              pendingCount={pendingCount}
              notifLoading={notifLoading}
              notifItems={notifItems}
              onNotifOpenChange={setNotifOpen}
              onNotifAction={(action, reservation) => goToReservationConfirm(action, reservation)}
            />
            <div className="px-4 pb-4">{children}</div>
          </main>
        </div>
      </div>
    </AdminSearchProvider>
  )
}
