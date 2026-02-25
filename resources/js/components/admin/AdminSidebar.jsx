import React, { useEffect, useMemo, useState } from "react"
import BrandMark from "../BrandMark"
import ActionMenu from "../ActionMenu"
import { withBasePath } from "../../lib/url"

const STORAGE_KEY = "br.admin.sidebar.collapsed"

function readStoredCollapsed() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === "1") return true
    if (raw === "0") return false
  } catch {
    // ignore
  }
  return false
}

function storeCollapsed(next) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
  } catch {
    // ignore
  }
}

function Icon({ children, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {children}
    </svg>
  )
}

function HomeIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </Icon>
  )
}

function UsersIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path
        d="M16 18.5c0-2-1.8-3.5-4-3.5s-4 1.5-4 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 13a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M20 18.5c0-1.5-1.2-2.7-2.8-3.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M17 6.3a3.2 3.2 0 0 1 0 6.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </Icon>
  )
}

function CalendarIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path
        d="M7 3v3M17 3v3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M5 7h14M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M8 11h3M13 11h3M8 15h3M13 15h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </Icon>
  )
}

function GearIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path
        d="M12 15.25a3.25 3.25 0 1 0 0-6.5a3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M19.4 15a8.1 8.1 0 0 0 .1-1l2-1.2-2-3.4-2.3.6a7.6 7.6 0 0 0-1.7-1l-.3-2.4H9l-.3 2.4a7.6 7.6 0 0 0-1.7 1L4.7 9.4l-2 3.4L4.7 14a8.1 8.1 0 0 0 .1 1a8.1 8.1 0 0 0-.1 1l-2 1.2 2 3.4 2.3-.6a7.6 7.6 0 0 0 1.7 1l.3 2.4h6l.3-2.4a7.6 7.6 0 0 0 1.7-1l2.3.6 2-3.4-2-1.2a8.1 8.1 0 0 0-.1-1Z"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
    </Icon>
  )
}

function LogoutIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path
        d="M10 7V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M3 12h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M6.5 8.5 3 12l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  )
}

function ChevronIcon({ className = "", direction = "left" }) {
  const rotate = direction === "right" ? "rotate-180" : ""
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} ${rotate}`} aria-hidden="true">
      <path d="M14 6 8 12l6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SidebarSectionLabel({ children, collapsed }) {
  return (
    <div
      className={`pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
        collapsed ? "px-0 text-center" : "px-3"
      }`}
    >
      {children}
    </div>
  )
}

function initials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim()
  if (!s) return "U"
  const parts = s.split(/\s+/).filter(Boolean)
  const first = parts[0] || ""
  const last = parts[parts.length - 1] || ""
  const a = first ? first[0].toUpperCase() : ""
  const b = last && last !== first ? last[0].toUpperCase() : ""
  return (a + b || a || "U").slice(0, 2)
}

function SidebarNavItem({ href, active, badge, disabled, collapsed, icon: IconEl, children }) {
  const common = disabled
    ? "cursor-not-allowed text-slate-400 dark:text-slate-500"
    : active
      ? "bg-brand-primary text-white dark:bg-brand-secondary dark:text-slate-900"
      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"

  const base = `relative flex h-11 items-center rounded-lg text-sm font-semibold transition-colors ${common} ${
    collapsed ? "w-11 justify-center px-0" : "w-full gap-3 px-3"
  }`

  const label = collapsed ? "sr-only" : "min-w-0 flex-1"
  const badgeEl = badge ? (
    collapsed ? (
      <span
        className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-flameRed px-1.5 text-[11px] font-semibold text-white"
      >
        {badge}
      </span>
    ) : (
      <span
        className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-flameRed px-1.5 text-xs font-semibold text-white"
      >
        {badge}
      </span>
    )
  ) : null

  if (disabled) {
    return (
      <span className={base} title={collapsed ? String(children) : undefined} aria-label={collapsed ? String(children) : undefined}>
        {IconEl ? <IconEl className="h-5 w-5" /> : null}
        <span className={label}>{children}</span>
        {badgeEl}
      </span>
    )
  }

  return (
    <a href={href} className={base} title={collapsed ? String(children) : undefined} aria-label={collapsed ? String(children) : undefined}>
      {IconEl ? <IconEl className="h-5 w-5" /> : null}
      <span className={label}>{children}</span>
      {badgeEl}
    </a>
  )
}

export default function AdminSidebar({ brand, user, path, perms, pendingCount, onLogout }) {
  const [collapsed, setCollapsed] = useState(() => (typeof window === "undefined" ? false : readStoredCollapsed()))

  useEffect(() => {
    storeCollapsed(collapsed)
  }, [collapsed])

  const items = useMemo(() => {
    return [
      perms.canDashboard
        ? { href: withBasePath("/admin"), label: "Dashboard", active: path === "/admin", icon: HomeIcon }
        : null,
      perms.canUsers
        ? { href: withBasePath("/admin/users"), label: "User Management", active: path.startsWith("/admin/users"), icon: UsersIcon }
        : null,
      perms.canReservations
        ? {
            href: withBasePath("/admin/reservations"),
            label: "Reservations",
            active: path.startsWith("/admin/reservations"),
            icon: CalendarIcon,
            badge: pendingCount > 0 ? pendingCount : null,
          }
        : null,
    ].filter(Boolean)
  }, [path, pendingCount, perms.canDashboard, perms.canReservations, perms.canUsers])

  const displayName = String(user?.name || "").trim() || String(user?.email || "").split("@")[0] || "User"
  const avatarFallback = initials(user?.name || user?.email)
  const avatarUrl = user?.id ? withBasePath(`/api/users/${user.id}/avatar?v=3`) : ""

  return (
    <aside
      className={`sticky top-0 h-screen shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
        collapsed ? "w-24" : "w-72"
      } transition-[width] duration-200 ease-out`}
    >
      <div className="flex h-full min-h-0 flex-col p-4">
        <div className={`w-full ${collapsed ? "flex flex-col items-center gap-3" : "flex items-center justify-between"}`}>
          <BrandMark brand={brand} size={32} showText={!collapsed} className={collapsed ? "justify-center" : ""} />
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronIcon className="h-5 w-5" direction={collapsed ? "right" : "left"} />
          </button>
        </div>

        <nav className={`mt-4 min-h-0 flex-1 overflow-y-auto ${collapsed ? "overflow-x-visible" : "overflow-x-hidden pr-1"}`}>
          <SidebarSectionLabel collapsed={collapsed}>Main</SidebarSectionLabel>
          <div className={`mt-2 flex flex-col gap-2 ${collapsed ? "items-center" : ""}`}>
            {items.map((it) => (
              <SidebarNavItem
                key={it.href}
                href={it.href}
                active={it.active}
                badge={it.badge}
                collapsed={collapsed}
                icon={it.icon}
              >
                {it.label}
              </SidebarNavItem>
            ))}
          </div>
        </nav>

        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-700">
                <div className="absolute inset-0 z-0 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-200">
                  {avatarFallback}
                </div>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="absolute inset-0 z-10 h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                ) : null}
              </div>

              <ActionMenu
                placement="top"
                buttonVariant="ghost"
                items={[
                  { label: "Settings", icon: <GearIcon className="h-4 w-4" />, onClick: () => window.location.assign(withBasePath("/admin/settings")) },
                  { label: "Logout", icon: <LogoutIcon className="h-4 w-4" />, variant: "danger", onClick: onLogout },
                ]}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-700">
                <div className="absolute inset-0 z-0 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-200">
                  {avatarFallback}
                </div>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="absolute inset-0 z-10 h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</div>
                <div className="truncate text-xs text-slate-600 dark:text-slate-400">{user.email}</div>
              </div>

              <ActionMenu
                placement="top"
                buttonVariant="ghost"
                items={[
                  { label: "Settings", icon: <GearIcon className="h-4 w-4" />, onClick: () => window.location.assign(withBasePath("/admin/settings")) },
                  { label: "Logout", icon: <LogoutIcon className="h-4 w-4" />, variant: "danger", onClick: onLogout },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
