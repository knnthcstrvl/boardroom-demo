import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import ReservationWhen from "./ReservationWhen"

function BellIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.7V3a2 2 0 0 0-4 0v1.3A7 7 0 0 0 5 11v5l-2 2v1h20v-1l-2-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function NotificationPopover({
  count = 0,
  loading = false,
  items = [],
  onOpenChange,
  onAction,
  className = "",
}) {
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState(null)
  const [maxHeight, setMaxHeight] = useState(420)

  const badge = Number(count || 0)
  const showBadge = Number.isFinite(badge) && badge > 0

  useEffect(() => {
    onOpenChange?.(open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const buttonClass = useMemo(() => {
    const base =
      "inline-flex h-10 w-10 items-center justify-center rounded-lg focus:outline-none"
    const styles = open
      ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    return `${base} ${styles} ${className}`
  }, [open, className])

  useEffect(() => {
    if (!open) return

    function computePosition() {
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const viewportW = window.innerWidth || 0
      const viewportH = window.innerHeight || 0

      const width = 420
      const left = Math.min(Math.max(8, rect.right - width), Math.max(8, viewportW - width - 8))
      const top = rect.bottom + 8
      const maxH = Math.min(520, Math.max(160, viewportH - top - 8))
      setMaxHeight(maxH)

      setPanelStyle({ position: "fixed", top, left, width, zIndex: 9999 })
    }

    computePosition()

    function onDocMouseDown(e) {
      const el = rootRef.current
      const panel = panelRef.current
      if (!el) return
      if (!el.contains(e.target) && !(panel && panel.contains(e.target))) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false)
    }
    function onScrollOrResize() {
      computePosition()
    }

    document.addEventListener("mousedown", onDocMouseDown)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("scroll", onScrollOrResize, true)
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", onScrollOrResize, true)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button type="button" className={buttonClass} onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        <span className="relative inline-flex">
          <BellIcon className="h-5 w-5" />
          {showBadge ? (
            <span className="absolute -right-3 -top-3 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-flameRed px-1.5 text-[11px] font-semibold leading-5 text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </span>
      </button>

      {open && panelStyle
        ? createPortal(
            <div
              ref={panelRef}
              style={panelStyle}
              className="overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">Pending reservations awaiting approval.</div>
              </div>

              <div className="overflow-auto p-2" style={{ maxHeight }}>
                {loading ? (
                  <div className="p-3 text-sm text-slate-600 dark:text-slate-400">Loading…</div>
                ) : items.length ? (
                  <div className="space-y-2">
                    {items.map((r) => {
                      const isRecurring = Boolean(r?.repeat_enabled || r?.repeat_series_id)
                      const requesterEmail = r.requester_email || r.requester?.email || "-"
                      const requesterDepartment = r.requester_department || r.requester?.department || ""

                      return (
                        <div
                          key={r.id}
                          className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40"
                        >
	                          <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{r.title || "-"}</div>
                              {isRecurring ? (
                                <span className="inline-flex shrink-0 items-center rounded-full border border-brand-secondary/40 bg-brand-secondary/15 px-2 py-0.5 text-[11px] font-semibold text-brand-secondary dark:border-brand-secondary/40 dark:bg-brand-secondary/20">
                                  Recurring
                                </span>
                              ) : (
                                <span className="inline-flex shrink-0 items-center rounded-full border border-brand-calmBlue/40 bg-brand-calmBlue/15 px-2 py-0.5 text-[11px] font-semibold text-brand-calmBlue dark:border-brand-calmBlue/40 dark:bg-brand-calmBlue/20">
                                  One-time
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                              <ReservationWhen reservation={r} appearance="plain" />
                            </div>
                            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                              Requested by:{" "}
                              <span className="font-medium text-slate-900 dark:text-slate-100">{requesterEmail}</span>
                            </div>
                            {requesterDepartment ? (
                              <div className="text-xs text-slate-500 dark:text-slate-400">{requesterDepartment}</div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onAction?.("approve", r)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-freshGreen text-white hover:bg-brand-freshGreen/90"
                              aria-label="Accept"
                              title="Accept"
                            >
                              <CheckIcon className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onAction?.("reject", r)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-flameRed text-white hover:bg-brand-flameRed/90"
                              aria-label="Reject"
                              title="Reject"
                            >
                              <XIcon className="h-5 w-5" />
                            </button>
	                          </div>
	                        </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-slate-600 dark:text-slate-400">No pending reservations.</div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
