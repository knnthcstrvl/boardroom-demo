import React from "react"

export default function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:border-slate-800 dark:disabled:bg-slate-900/50 dark:disabled:text-slate-400 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}
