import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

function FunnelIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 5h18l-7 8v5l-4 2v-7L3 5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function FilterPopover({
  label = "Filters",
  activeCount = 0,
  align = "start", // start | end
  children,
  className = "",
  panelClassName = "",
}) {
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState(null)
  const [maxHeight, setMaxHeight] = useState(420)

  const count = Number(activeCount || 0)
  const showCount = Number.isFinite(count) && count > 0

    const buttonClass = useMemo(() => {
      const base =
      "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-brand-primary/50 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      const styles = open ? "bg-slate-50 dark:bg-slate-800/50" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
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

      const width = Math.max(320, Math.min(420, rect.width + 220))
      const desiredLeft = align === "end" ? rect.right - width : rect.left
      const left = Math.min(Math.max(8, desiredLeft), Math.max(8, viewportW - width - 8))
      const top = rect.bottom + 8
      const maxH = Math.min(520, Math.max(160, viewportH - top - 8))
      setMaxHeight(maxH)

      setPanelStyle({
        position: "fixed",
        top,
        left,
        width,
        zIndex: 9999,
      })
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
  }, [open, align])

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button type="button" onClick={() => setOpen((v) => !v)} className={buttonClass}>
        <span>{label}</span>
        {showCount ? (
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {count}
          </span>
        ) : null}
        <FunnelIcon className="h-4 w-4 text-slate-900 dark:text-slate-100" />
      </button>

      {open && panelStyle
        ? createPortal(
            <div
              ref={panelRef}
              style={panelStyle}
              className={`overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 ${panelClassName}`}
            >
              <div className="overflow-auto p-4" style={{ maxHeight }}>
                {children}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
