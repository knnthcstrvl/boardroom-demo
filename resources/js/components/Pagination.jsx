import React, { useMemo } from "react"
import Button from "./Button"

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function buildPages(current, last) {
  const c = Number(current || 1)
  const l = Number(last || 1)
  if (l <= 7) return Array.from({ length: l }, (_, i) => i + 1)

  const pages = new Set([1, l, c, c - 1, c + 1, c - 2, c + 2])
  const list = Array.from(pages)
    .filter((p) => p >= 1 && p <= l)
    .sort((a, b) => a - b)

  const out = []
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    const prev = out[out.length - 1]
    if (prev && typeof prev === "number" && p - prev > 1) out.push("…")
    out.push(p)
  }
  return out
}

export default function Pagination({ meta, onPageChange, className = "" }) {
  const current = Number(meta?.current_page || 1)
  const last = Number(meta?.last_page || 1)
  const from = meta?.from ?? null
  const to = meta?.to ?? null
  const total = meta?.total ?? null

  const pages = useMemo(() => buildPages(current, last), [current, last])

  if (!meta || last <= 1) {
    return total != null ? (
      <div className={`flex items-center justify-between gap-3 text-sm text-slate-600 ${className}`}>
        <div>
          {from != null && to != null ? (
            <span>
              Showing {from}–{to} of {total}
            </span>
          ) : (
            <span>Total: {total}</span>
          )}
        </div>
      </div>
    ) : null
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {from != null && to != null && total != null ? (
          <span>
            Showing {from}–{to} of {total}
          </span>
        ) : (
          <span>
            Page {current} of {last}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="secondary"
          className="text-slate-700 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-slate-800"
          onClick={() => onPageChange?.(clamp(current - 1, 1, last))}
          disabled={current <= 1}
        >
          Prev
        </Button>

        {pages.map((p, idx) =>
          p === "…" ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-sm text-slate-500">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange?.(p)}
              className={`min-w-9 rounded-lg px-3 py-2 text-sm font-semibold ring-1 ${
                p === current
                  ? "bg-brand-primary text-white ring-brand-primary dark:bg-brand-secondary dark:text-slate-900 dark:ring-brand-secondary"
                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-slate-800"
              }`}
            >
              {p}
            </button>
          )
        )}

        <Button
          variant="secondary"
          className="text-slate-700 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-slate-800"
          onClick={() => onPageChange?.(clamp(current + 1, 1, last))}
          disabled={current >= last}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
