import React from "react"

export default function Alert({ children }) {
  if (!children) return null

  return (
    <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
      {children}
    </div>
  )
}

