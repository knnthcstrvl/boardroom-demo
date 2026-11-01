import React, { useState } from "react"
import axios from "../lib/http"
import BrandMark from "../components/BrandMark"
import { withBasePath } from "../lib/url"

export default function Login() {
  const brand = window.__BRANDING__ || { name: "BoardRoom", logoUrlDark: "", logoUrlLight: "" }
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState("")

  async function loginAsDemoAdmin() {
    setDemoLoading(true)
    setDemoError("")

    try {
      const response = await axios.post("/auth/demo-admin")
      window.location.assign(response.data?.redirect || withBasePath("/kiosk"))
    } catch (error) {
      setDemoError(error?.response?.status === 503
        ? "The demo admin account is not available. Please contact the demo host."
        : "Unable to sign in to the demo. Please try again.")
      setDemoLoading(false)
    }
  }

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

          {window.__DEMO_ADMIN_LOGIN_ENABLED__ && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                Demo access
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>
              <button
                type="button"
                onClick={loginAsDemoAdmin}
                disabled={demoLoading}
                className="inline-flex w-full items-center justify-center rounded-lg border border-brand-primary/30 bg-white px-4 py-2.5 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-secondary/40 dark:bg-slate-900 dark:text-brand-secondary dark:hover:bg-slate-800"
              >
                {demoLoading ? "Signing in…" : "Continue as demo admin"}
              </button>
              {demoError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{demoError}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
