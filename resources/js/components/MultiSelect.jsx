import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

function normalizeValue(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : []
}

export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  lockedValues = [],
  disabledValues = [],
  disabled = false,
  className = "",
}) {
  const selected = normalizeValue(value)
  const locked = useMemo(() => new Set(normalizeValue(lockedValues)), [lockedValues])
  const disabledSet = useMemo(() => new Set(normalizeValue(disabledValues)), [disabledValues])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const rootRef = useRef(null)
  const dropdownRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState(null)
  const [listMaxHeight, setListMaxHeight] = useState(256)

  useEffect(() => {
    if (!open) return
    function computePosition() {
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const viewportW = window.innerWidth || 0
      const viewportH = window.innerHeight || 0

      const width = Math.max(240, rect.width)
      const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportW - width - 8))
      const top = rect.bottom + 8
      const maxH = Math.min(320, Math.max(0, viewportH - top - 8))
      setListMaxHeight(maxH)

      setDropdownStyle({
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
      const dropdown = dropdownRef.current
      if (!el) return
      if (!el.contains(e.target) && !(dropdown && dropdown.contains(e.target))) {
        setOpen(false)
      }
    }
    function onScrollOrResize() {
      computePosition()
    }
    document.addEventListener("mousedown", onDocMouseDown)
    window.addEventListener("scroll", onScrollOrResize, true)
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown)
      window.removeEventListener("scroll", onScrollOrResize, true)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [open])

  function removeValue(v) {
    if (locked.has(v)) return
    onChange?.(selected.filter((x) => x !== v))
  }

  function toggleValue(v) {
    if (locked.has(v) || disabledSet.has(v)) return
    if (selectedSet.has(v)) removeValue(v)
    else onChange?.([...selected, v])
  }

  const renderSelected = selected
    .map((v) => {
      const opt = (options || []).find((o) => o.value === v)
      return opt ? { value: v, label: opt.label } : { value: v, label: v }
    })
    .filter(Boolean)

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((v) => !v)
        }}
        className="flex min-h-[42px] w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 focus:border-brand-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:border-slate-800 dark:disabled:bg-slate-900/50 dark:disabled:text-slate-400"
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {renderSelected.length ? (
            renderSelected.map((s) => (
              <span
                key={s.value}
                className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                  locked.has(s.value)
                    ? "border-slate-200 bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200"
                }`}
                title={s.label}
              >
                <span className="truncate">{s.label}</span>
                {locked.has(s.value) ? null : (
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeValue(s.value)
                    }}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                    aria-label={`Remove ${s.label}`}
                  >
                    ✕
                  </span>
                )}
              </span>
            ))
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
        </div>

        <span className="ml-auto text-slate-500 dark:text-slate-400">▾</span>
      </button>

      {open && dropdownStyle
        ? createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              onMouseDown={(e) => e.stopPropagation()}
              className="overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div className="overflow-auto py-1" style={{ maxHeight: listMaxHeight }}>
                {(options || []).length ? (
                  (options || []).map((o) => {
                    const v = o.value
                    const checked = selectedSet.has(v)
                    const isLocked = locked.has(v)
                    const isDisabled = isLocked || disabledSet.has(v)
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleValue(v)}
                        disabled={isDisabled}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                          checked
                            ? "bg-brand-primary/10 text-brand-primary dark:bg-brand-secondary/20 dark:text-brand-secondary"
                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                        } ${isDisabled ? "cursor-not-allowed opacity-60 hover:bg-transparent" : ""}`}
                      >
                        <span className="truncate">{o.label}</span>
                        <span className={`text-sm ${checked ? "text-brand-primary dark:text-brand-secondary" : "text-slate-500 dark:text-slate-400"}`}>
                          {checked ? "✓" : ""}
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No options.</div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
