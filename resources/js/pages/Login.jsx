import React from "react"
import BrandMark from "../components/BrandMark"
import { withBasePath } from "../lib/url"

export default function Login() {
  const brand = window.__BRANDING__ || { name: "BoardRoom", logoUrlDark: "", logoUrlLight: "" }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <div className="w-full rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <BrandMark brand={brand} />
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Sign in with your Microsoft account to access the admin panel.</p>

          <a
            href={withBasePath("/auth/microsoft/redirect")}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-primary/90 dark:bg-brand-secondary dark:text-slate-900 dark:hover:bg-brand-secondary/90"
          >
            Sign in with Microsoft
          </a>
        </div>
      </div>
    </div>
  )
}
