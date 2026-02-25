import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

function DotsIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 6.5a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3Zm0 7a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3Zm0 7a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function ActionMenu({
  items = [],
  disabled = false,
  placement = "bottom",
  buttonVariant = "default",
  buttonClassName = "",
  className = "",
}) {
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState(null)

  const safeItems = useMemo(() => (Array.isArray(items) ? items.filter(Boolean) : []), [items])

  useEffect(() => {
    if (!open) return

    function computePosition() {
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const viewportW = window.innerWidth || 0
      const viewportH = window.innerHeight || 0
      const width = 200

      const left = Math.min(Math.max(8, rect.right - width), Math.max(8, viewportW - width - 8))
      const estimatedPanelH = Math.min(320, Math.max(160, safeItems.length * 40))
      const fitsBottom = rect.bottom + 8 + estimatedPanelH <= viewportH - 8
      const fitsTop = rect.top - 8 - estimatedPanelH >= 8

      const effectivePlacement = placement === "auto" ? (fitsBottom || !fitsTop ? "bottom" : "top") : placement

      if (effectivePlacement === "top") {
        const bottom = Math.min(viewportH - 8, Math.max(8, viewportH - rect.top + 8))
        const maxH = Math.min(320, Math.max(120, rect.top - 16))
        setPanelStyle({ position: "fixed", bottom, left, width, maxHeight: maxH, zIndex: 9999 })
      } else {
        const top = rect.bottom + 8
        const maxH = Math.min(320, Math.max(120, viewportH - top - 8))
        setPanelStyle({ position: "fixed", top, left, width, maxHeight: maxH, zIndex: 9999 })
      }
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
  }, [open, placement, safeItems.length])

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((v) => !v)
        }}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
          buttonVariant === "ghost"
            ? "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-slate-800"
        } ${buttonClassName}`}
        aria-label="Actions"
        title="Actions"
      >
        <DotsIcon className="h-5 w-5" />
      </button>

      {open && panelStyle
        ? createPortal(
            <div
              ref={panelRef}
              style={panelStyle}
              className="overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div className="max-h-[inherit] overflow-auto py-1">
                {safeItems.length ? (
                  safeItems.map((item, idx) => {
                    const isDisabled = Boolean(item.disabled)
                    const isDanger = item.variant === "danger"
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) return
                          setOpen(false)
                          item.onClick?.()
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                          isDisabled
                            ? "cursor-not-allowed text-slate-400 dark:text-slate-600"
                            : isDanger
                              ? "text-brand-flameRed hover:bg-brand-flameRed/10 dark:text-brand-flameRed dark:hover:bg-brand-flameRed/15"
                              : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        {item.icon ? (
                          <span className={isDanger ? "text-brand-flameRed" : "text-slate-500 dark:text-slate-400"}>{item.icon}</span>
                        ) : null}
                        <span className="truncate">{item.label}</span>
                      </button>
                    )
                  })
                ) : (
                  <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">No actions.</div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
