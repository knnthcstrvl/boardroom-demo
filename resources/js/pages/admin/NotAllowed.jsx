import React from "react"
import { withBasePath } from "../../lib/url"

export default function NotAllowed({ title = "Not allowed", message = "You don’t have access to this page." }) {
  return (
    <div className="bg-transparent">
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
      <a href={withBasePath("/admin")} className="mt-4 inline-flex text-sm font-medium text-brand-primary hover:underline">
        Go back to Dashboard
      </a>
    </div>
  )
}
