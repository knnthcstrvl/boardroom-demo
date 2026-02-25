import React from "react"
import Spinner from "./Spinner"

export default function Button({
  variant = "primary",
  className = "",
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"

  const styles = {
    primary:
      "bg-brand-primary text-white hover:bg-brand-primary/90 dark:bg-brand-secondary dark:text-slate-900 dark:hover:bg-brand-secondary/90",
    secondary:
      "bg-white text-brand-primary ring-1 ring-brand-primary/30 hover:bg-brand-primary/5 dark:bg-slate-900 dark:ring-brand-primary/40 dark:hover:bg-slate-800",
    neutral:
      "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800",
    danger: "bg-brand-flameRed text-white hover:bg-brand-flameRed/90",
    success: "bg-brand-freshGreen text-white hover:bg-brand-freshGreen/90",
  }

  return (
    <button
      className={`${base} ${styles[variant]} ${className}`}
      disabled={Boolean(disabled) || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Spinner
            size={14}
            className={
              variant === "secondary" || variant === "neutral"
                ? ""
                : "[&>span]:border-white/50 [&>span]:border-t-white dark:[&>span]:border-slate-900/30 dark:[&>span]:border-t-slate-900"
            }
          />
          <span>{loadingText || children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}
