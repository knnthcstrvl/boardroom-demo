import React from "react"

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    window.__APP_LAST_ERROR__ = String(error)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4">
          <div className="w-full rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Something went wrong</div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">The page crashed. Refresh to retry.</div>
            <pre className="mt-4 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800">
              {String(this.state.error)}
            </pre>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 dark:bg-brand-secondary dark:text-slate-900 dark:hover:bg-brand-secondary/90"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
