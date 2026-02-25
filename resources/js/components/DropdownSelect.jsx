import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

export default function DropdownSelect({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Select…",
  align = "start", // start | end
  className = "",
}) {
  const rootRef = useRef(null)
  const dropdownRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState(null)
  const [listMaxHeight, setListMaxHeight] = useState(256)

  const selected = useMemo(() => {
    const list = Array.isArray(options) ? options : []
    const found = list.find((o) => o?.value === value)
    return found || null
  }, [options, value])

  useEffect(() => {
    if (!open) return
    function computePosition() {
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const viewportW = window.innerWidth || 0
      const viewportH = window.innerHeight || 0

      const width = Math.max(240, rect.width)
      const desiredLeft = align === "end" ? rect.right - width : rect.left
      const left = Math.min(Math.max(8, desiredLeft), Math.max(8, viewportW - width - 8))
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
  }, [open, align])

  const label = selected?.label || (value ? String(value) : "")

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
        <span className={label ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}>{label || placeholder}</span>
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
                {(options || []).map((o) => {
                  const v = o.value
                  const checked = v === value
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        onChange?.(v)
                        setOpen(false)
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                        checked
                          ? "bg-brand-primary/10 text-brand-primary dark:bg-brand-secondary/20 dark:text-brand-secondary"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="truncate">{o.label}</span>
                      <span className={`text-sm ${checked ? "text-brand-primary dark:text-brand-secondary" : "text-slate-500 dark:text-slate-400"}`}>
                        {checked ? "✓" : ""}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
