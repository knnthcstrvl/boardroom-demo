import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"

const ToastContext = createContext(null)

function iconFor(variant) {
  const base = "h-5 w-5"
  if (variant === "success") {
    return (
      <svg viewBox="0 0 24 24" className={base} aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm-1.1 13.5l-3.4-3.4l1.4-1.4l2 2l5.6-5.6l1.4 1.4l-7 7Z"
        />
      </svg>
    )
  }
  if (variant === "error") {
    return (
      <svg viewBox="0 0 24 24" className={base} aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm1 14h-2v-2h2v2Zm0-4h-2V6h2v6Z"
        />
      </svg>
    )
  }
  if (variant === "warning") {
    return (
      <svg viewBox="0 0 24 24" className={base} aria-hidden="true">
        <path
          fill="currentColor"
          d="M1 21h22L12 2 1 21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={base} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"
      />
    </svg>
  )
}

function stylesFor(variant) {
  if (variant === "success") return { iconBg: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" }
  if (variant === "error") return { iconBg: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" }
  if (variant === "warning") return { iconBg: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" }
  return { iconBg: "bg-sky-50 text-sky-700 ring-1 ring-sky-200" }
}

function ToastItem({ toast, onClose }) {
  const { iconBg } = stylesFor(toast.variant)

  return (
    <div className="w-full overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex gap-3 p-4">
        <div className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
          {iconFor(toast.variant)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{toast.title}</div>
              {toast.message ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{toast.message}</div> : null}
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>

          {toast.actions?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {toast.actions.map((a, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={a.onClick}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    a.variant === "primary"
                      ? "bg-brand-primary text-white hover:bg-brand-primary/90 dark:bg-brand-secondary dark:text-slate-900 dark:hover:bg-brand-secondary/90"
                      : "bg-white text-brand-primary ring-1 ring-brand-primary/30 hover:bg-brand-primary/5 dark:bg-slate-900 dark:ring-brand-primary/40 dark:hover:bg-slate-800"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const push = useCallback(
    ({ variant = "info", title = "Information", message = "", actions = [], duration = 5000 }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const toast = { id, variant, title, message, actions }
      setToasts((prev) => [toast, ...prev].slice(0, 5))

      if (duration && duration > 0) {
        const timer = setTimeout(() => remove(id), duration)
        timersRef.current.set(id, timer)
      }
      return id
    },
    [remove]
  )

  const value = useMemo(() => ({ push, remove }), [push, remove])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-6 top-6 z-[100] w-[360px] max-w-[calc(100vw-3rem)] space-y-3">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
