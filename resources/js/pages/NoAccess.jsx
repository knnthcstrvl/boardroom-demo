import React from "react"
import Button from "../components/Button"
import BrandMark from "../components/BrandMark"

export default function NoAccess({ user, onLogout }) {
  const brand = window.__BRANDING__ || { name: "BoardRoom", logoUrlDark: "", logoUrlLight: "" }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <BrandMark brand={brand} />
        <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">{user?.email || ""}</div>

        <div className="mt-6 text-sm font-semibold text-slate-900 dark:text-slate-100">Access required</div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Your account does not have any access levels assigned yet. Please contact an administrator to request access.
        </p>

        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
