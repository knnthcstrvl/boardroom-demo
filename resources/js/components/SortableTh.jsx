import React from "react"

export default function SortableTh({ label, sortKey, sortBy, sortDir, onChange, onClear, className = "" }) {
  const active = sortKey && sortBy === sortKey
  const dir = active ? (sortDir === "asc" ? "asc" : "desc") : null
  const indicator = !active ? "" : dir === "asc" ? " ▲" : " ▼"

  return (
    <th className={`px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 ${className}`}>
      {sortKey ? (
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const nextDir = active ? (sortDir === "asc" ? "desc" : "asc") : "desc"
              onChange?.(sortKey, nextDir)
            }}
            className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 ${active ? "text-slate-900 dark:text-slate-100" : ""}`}
          >
            <span>{label}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{indicator}</span>
          </button>

          {active && onClear ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClear?.()
              }}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label={`Clear sort for ${label}`}
              title="Clear sort"
            >
              ✕
            </button>
          ) : null}
        </span>
      ) : (
        label
      )}
    </th>
  )
}
