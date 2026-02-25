import React from "react"

export default function Settings() {
  return (
    <div className="bg-transparent">
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Settings</div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Configure Microsoft SSO and Outlook SMTP via environment variables in{" "}
        <code className="font-mono text-slate-900 dark:text-slate-100">.env</code>.
      </p>
    </div>
  )
}
