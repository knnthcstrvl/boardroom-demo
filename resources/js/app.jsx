import "./bootstrap"

import React, { Suspense, useEffect, useMemo } from "react"
import { createRoot } from "react-dom/client"
import axios, { initHttp } from "./lib/http"
import { getThemeScope, initTheme } from "./lib/theme"
import Kiosk from "./pages/Kiosk"
import { ToastProvider } from "./components/ToastProvider"
import ErrorBoundary from "./components/ErrorBoundary"
import { getPermissions } from "./lib/permissions"
import { stripBasePath, withBasePath } from "./lib/url"

const Login = React.lazy(() => import("./pages/Login"))
const AdminLayout = React.lazy(() => import("./layouts/AdminLayout"))
const Dashboard = React.lazy(() => import("./pages/admin/Dashboard"))
const Users = React.lazy(() => import("./pages/admin/Users"))
const KioskAdmin = React.lazy(() => import("./pages/admin/KioskAdmin"))
const Settings = React.lazy(() => import("./pages/admin/Settings"))
const Profile = React.lazy(() => import("./pages/admin/Profile"))
const NoAccess = React.lazy(() => import("./pages/NoAccess"))
const NotAllowed = React.lazy(() => import("./pages/admin/NotAllowed"))

initHttp()
initTheme(getThemeScope())

window.__APP_BOOTED__ = true

function AppLoading() {
  // Avoid showing a second "page loader" after the Blade splash.
  return null
}

function RedirectToKiosk() {
  useEffect(() => {
    window.location.replace(withBasePath("/kiosk"))
  }, [])

  return null
}

function App() {
  const user = window.__AUTH_USER__
  const path = stripBasePath(window.location.pathname)
  const perms = useMemo(() => getPermissions(user), [user])

  const page = useMemo(() => {
    if (path === "/login") return { kind: "login" }
    if (path.startsWith("/admin")) return { kind: user ? "admin" : "login" }
    return { kind: "kiosk" }
  }, [path, user])

  useEffect(() => {
    initTheme(getThemeScope(path))
  }, [path])

  async function logout() {
    await axios.post("/logout")
    window.location.assign(withBasePath("/login"))
  }

  if (user && !perms.anyAccess) {
    return (
      <Suspense fallback={<AppLoading />}>
        <NoAccess user={user} onLogout={logout} />
      </Suspense>
    )
  }

  if (page.kind === "login")
    return (
      <Suspense fallback={<AppLoading />}>
        {user ? <RedirectToKiosk /> : <Login />}
      </Suspense>
    )

  if (page.kind === "admin") {
    const adminPath = path === "/admin/" ? "/admin" : path
    const content =
      adminPath === "/admin" ? (
        perms.canDashboard ? (
          <Dashboard />
        ) : (
          <NotAllowed />
        )
      ) : adminPath.startsWith("/admin/users") ? (
        perms.canUsers ? (
          <Users />
        ) : (
          <NotAllowed title="No access to User Management" message="Contact an administrator to request access." />
        )
      ) : adminPath.startsWith("/admin/profile") ? (
        <Profile />
      ) : adminPath.startsWith("/admin/reservations") ? (
        perms.canReservations ? (
          <KioskAdmin />
        ) : (
          <NotAllowed title="No access to Reservations" message="Only approvers can access reservations." />
        )
      ) : adminPath.startsWith("/admin/settings") ? (
        perms.canSettings ? (
          <Settings />
        ) : (
          <NotAllowed title="No access to Settings" message="Only approvers can access settings." />
        )
      ) : (
        <Dashboard />
      )

    return (
      <Suspense fallback={<AppLoading />}>
        <AdminLayout user={user} path={adminPath} onLogout={logout}>
          {content}
        </AdminLayout>
      </Suspense>
    )
  }

  return <Kiosk user={user} />
}

const el = document.getElementById("app")
if (el)
  window.setTimeout(() => {
    createRoot(el).render(
      <ToastProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ToastProvider>
    )
    window.__APP_MOUNTED__ = true
  }, Math.max(0, Number(window.__MIN_BOOT_SPLASH_MS__ || 0) - (Date.now() - Number(window.__BOOT_SPLASH_STARTED_AT__ || 0))))
