import React from "react"

export default function Spinner({ size = 16, className = "", label = "Loading" }) {
  const px = Number(size) || 16
  return (
    <span className={`inline-flex items-center ${className}`} aria-label={label}>
      <span
        className="inline-block animate-spin rounded-full border-2 border-slate-300 border-t-brand-primary dark:border-slate-700"
        style={{ width: px, height: px }}
        aria-hidden="true"
      />
    </span>
  )
}
