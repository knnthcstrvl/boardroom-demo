import React, { useEffect, useMemo, useState } from "react"
import axios from "../../lib/http"
import Button from "../../components/Button"
import Input from "../../components/Input"
import Modal from "../../components/Modal"
import TableSkeleton from "../../components/TableSkeleton"
import { useToast } from "../../components/ToastProvider"
import ModalSubmitting from "../../components/ModalSubmitting"
import MultiSelect from "../../components/MultiSelect"
import DropdownSelect from "../../components/DropdownSelect"
import { getPermissions } from "../../lib/permissions"
import { formatManilaTime12, manilaParts } from "../../lib/manilaTime"
import Pagination from "../../components/Pagination"
import SortableTh from "../../components/SortableTh"
import FilterPopover from "../../components/FilterPopover"
import ActionMenu from "../../components/ActionMenu"
import { createUserStream } from "../../lib/userStream"

const ACCESS_OPTIONS = [
  { value: "approver", label: "Approver" },
  { value: "view", label: "View" },
  { value: "add", label: "Add" },
  { value: "edit", label: "Edit" },
  { value: "delete", label: "Delete" },
]

const ADMIN_DEFAULT_ACCESS = ["add", "edit", "delete"]
const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
]

export default function Users() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [pageMeta, setPageMeta] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [streamNonce, setStreamNonce] = useState(0)
  const { push: pushToast } = useToast()

  const [qInput, setQInput] = useState("")
  const [q, setQ] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [accessAny, setAccessAny] = useState([])
  const [sortBy, setSortBy] = useState("created_at")
  const [sortDir, setSortDir] = useState("desc")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteUser, setDeleteUser] = useState(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [access, setAccess] = useState([])

  const actor = window.__AUTH_USER__
  const perms = getPermissions(actor)

  const perPageOptions = useMemo(() => {
    return [
      { value: 10, label: "10 / page" },
      { value: 25, label: "25 / page" },
      { value: 50, label: "50 / page" },
    ]
  }, [])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (roleFilter) count++
    if (Array.isArray(accessAny) && accessAny.length) count++
    return count
  }, [roleFilter, accessAny])

  useEffect(() => {
    const id = window.setTimeout(() => setQ(qInput), 250)
    return () => window.clearTimeout(id)
  }, [qInput])

  useEffect(() => {
    setPage(1)
  }, [q, roleFilter, JSON.stringify(accessAny), sortBy, sortDir, perPage])

  async function load() {
    setLoading(true)
    try {
      const { data } = await axios.get("/api/users", {
        params: {
          q: q || undefined,
          role: roleFilter || undefined,
          access_any: accessAny?.length ? accessAny : undefined,
          sort_by: sortBy || undefined,
          sort_dir: sortDir || undefined,
          per_page: perPage,
          page,
        },
      })
      setRows(data.data || [])
      setPageMeta(data)
    } catch (e) {
      pushToast({
        variant: "error",
        title: "Something went wrong",
        message: e?.response?.data?.message || "Failed to load users.",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, roleFilter, accessAny, sortBy, sortDir, page, perPage, streamNonce])

  useEffect(() => {
    const stream = createUserStream()

    let refreshTimer = null
    let pollTimer = null
    let resetToFirstPage = false
    function scheduleRefresh({ resetPage } = {}) {
      if (resetPage) resetToFirstPage = true
      if (refreshTimer) return
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        if (resetToFirstPage) setPage(1)
        resetToFirstPage = false
        setStreamNonce((n) => n + 1)
      }, 300)
    }

    function startPolling() {
      if (pollTimer) return
      // Fallback when SSE can't deliver events (e.g., missing user_events table / SSE blocked by proxy).
      pollTimer = window.setInterval(() => {
        setStreamNonce((n) => n + 1)
      }, 5000)
    }

    function onUserChanged(e) {
      try {
        const payload = JSON.parse(e?.data || "{}")
        if (payload?.type === "user.created") {
          scheduleRefresh({ resetPage: true })
          return
        }
      } catch {
        // ignore parse errors
      }
      scheduleRefresh()
    }

    function onStreamError() {
      // If the stream is failing, don't rely on manual refresh.
      startPolling()
      scheduleRefresh()
    }

    stream.addEventListener("user.changed", onUserChanged)
    stream.addEventListener("error", onStreamError)

    return () => {
      stream.close()
      if (refreshTimer) window.clearTimeout(refreshTimer)
      if (pollTimer) window.clearInterval(pollTimer)
    }
  }, [])

  function clearSort() {
    setSortBy("created_at")
    setSortDir("desc")
  }

  function ensureAdminDefaults(nextIsAdmin) {
    if (!nextIsAdmin) return
    setAccess((prev) => {
      const set = new Set(prev || [])
      for (const key of ADMIN_DEFAULT_ACCESS) set.add(key)
      return Array.from(set)
    })
  }

  function normalizeAccess(nextAccess, nextIsAdmin) {
    const set = new Set(Array.isArray(nextAccess) ? nextAccess : [])
    if (set.has("approver")) set.delete("view")
    if (nextIsAdmin) {
      for (const key of ADMIN_DEFAULT_ACCESS) set.add(key)
    }
    return Array.from(set)
  }

  function startCreate() {
    setEditing({ id: null })
    setName("")
    setEmail("")
    setIsAdmin(false)
    setAccess([])
    setFormOpen(true)
  }

  function startEdit(user) {
    if (user?.is_admin && !perms.isAdmin) return
    setEditing(user)
    setName(user.name || "")
    setEmail(user.email || "")
    const nextIsAdmin = Boolean(user.is_admin)
    setIsAdmin(nextIsAdmin)
    setAccess(normalizeAccess(user.access || [], nextIsAdmin))
    setFormOpen(true)
  }

  async function save(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const payload = { name, email, is_admin: isAdmin, access }
      if (editing?.id) {
        await axios.put(`/api/users/${editing.id}`, payload)
        pushToast({ variant: "success", title: "Saved", message: "User updated." })
      } else {
        await axios.post("/api/users", payload)
        pushToast({ variant: "success", title: "Saved", message: "User created." })
      }
      setEditing(null)
      setFormOpen(false)
      await load()
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to save user."
      pushToast({ variant: "error", title: "Something went wrong", message: msg })
    } finally {
      setSaving(false)
    }
  }

  function openDelete(u) {
    if (u?.is_admin && !perms.isAdmin) return
    setDeleteUser(u)
    setDeleteOpen(true)
  }

  async function remove() {
    if (!deleteUser?.id) return
    if (deleting) return
    setDeleting(true)
    try {
      await axios.delete(`/api/users/${deleteUser.id}`)
      await load()
      setDeleteOpen(false)
      setDeleteUser(null)
      pushToast({ variant: "success", title: "Deleted", message: "User deleted." })
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to delete user."
      pushToast({ variant: "error", title: "Something went wrong", message: msg })
    } finally {
      setDeleting(false)
    }
  }

  function formatAccess(list) {
    const a = Array.isArray(list) ? list : []
    const map = new Map(ACCESS_OPTIONS.map((o) => [o.value, o.label]))
    return a.map((k) => map.get(k) || k)
  }

  function formatCreated(d) {
    if (!d) return "-"
    const ms = new Date(d).getTime()
    if (!Number.isFinite(ms)) return "-"
    const p = manilaParts(ms)
    const month =
      p.month === 1
        ? "Jan."
        : p.month === 2
          ? "Feb."
          : p.month === 3
            ? "Mar."
            : p.month === 4
              ? "Apr."
              : p.month === 5
                ? "May"
                : p.month === 6
                  ? "Jun."
                  : p.month === 7
                    ? "Jul."
                    : p.month === 8
                      ? "Aug."
                      : p.month === 9
                        ? "Sep."
                        : p.month === 10
                          ? "Oct."
                          : p.month === 11
                            ? "Nov."
                            : "Dec."

    return `${month} ${p.day}, ${p.year}, ${formatManilaTime12(ms)}`
  }

  function Pill({ children, variant = "gray" }) {
    const styles =
      variant === "green"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
        : variant === "blue"
          ? "border-brand-calmBlue/40 bg-brand-calmBlue/15 text-brand-calmBlue dark:border-brand-calmBlue/40 dark:bg-brand-calmBlue/20 dark:text-brand-calmBlue"
        : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
    return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${styles}`}>{children}</span>
  }

  function sortIndicator(key) {
    if (sortBy !== key) return ""
    return sortDir === "asc" ? " ▲" : " ▼"
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

  return (
    <div className="space-y-6">
      <div className="bg-transparent">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">User Management</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">Create users and assign access levels.</div>
          </div>
          <Button onClick={startCreate} disabled={!perms.canAdd}>
            New User
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-full max-w-[420px]">
            <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search..." />
          </div>

          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <FilterPopover activeCount={activeFilterCount} align="end">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filters</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">Narrow down results.</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Role</label>
                    <DropdownSelect
                      options={[{ value: "", label: "All roles" }, ...ROLE_OPTIONS]}
                      value={roleFilter}
                      onChange={(v) => setRoleFilter(v)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Access levels</label>
                    <MultiSelect
                      options={ACCESS_OPTIONS}
                      value={accessAny}
                      onChange={(next) => setAccessAny(Array.isArray(next) ? next : [])}
                      placeholder="Any access..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="neutral"
                    type="button"
                    onClick={() => {
                      setRoleFilter("")
                      setAccessAny([])
                    }}
                    disabled={!roleFilter && !(Array.isArray(accessAny) && accessAny.length)}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </FilterPopover>

            <div className="w-[160px]">
              <DropdownSelect options={perPageOptions} value={perPage} align="end" onChange={(v) => setPerPage(Number(v) || 10)} />
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-slate-200 dark:ring-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const nextDir = sortBy === "name" ? (sortDir === "asc" ? "desc" : "asc") : "desc"
                          setSortBy("name")
                          setSortDir(nextDir)
                        }}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 ${
                          sortBy === "name" ? "text-slate-900 dark:text-slate-100" : ""
                        }`}
                      >
                        <span>User</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{sortIndicator("name")}</span>
                      </button>
                      {sortBy === "name" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            clearSort()
                          }}
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          aria-label="Clear sort"
                          title="Clear sort"
                        >
                          ✕
                        </button>
                      ) : null}
                    </span>
                  </div>
                </th>
                <SortableTh
                  label="Role"
                  sortKey="role"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onChange={(k, d) => (setSortBy(k), setSortDir(d))}
                  onClear={clearSort}
                />
                <SortableTh
                  label="Access Levels"
                  sortKey="access"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onChange={(k, d) => (setSortBy(k), setSortDir(d))}
                  onClear={clearSort}
                />
                <SortableTh
                  label="Created"
                  sortKey="created_at"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onChange={(k, d) => (setSortBy(k), setSortDir(d))}
                  onClear={clearSort}
                />
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {loading && !rows.length ? (
                <TableSkeleton columns={5} rows={6} />
              ) : rows.length ? (
                rows.map((u) => (
                  <tr key={u.id}>
	                    <td className="px-3 py-2">
	                      <div className="flex min-w-0 items-center gap-3">
	                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand-primary/20 dark:bg-brand-primary/30">
	                          <div className="absolute inset-0 z-0 flex items-center justify-center text-sm font-bold leading-none text-brand-primary dark:text-slate-100">
	                            {initials(u.name || u.email)}
	                          </div>
	                          <img
	                            src={u?.id ? `/api/users/${u.id}/avatar?v=4` : ""}
	                            alt=""
	                            className="absolute inset-0 z-10 h-full w-full object-cover"
	                            loading="lazy"
	                            onError={(e) => {
	                              e.currentTarget.style.display = "none"
	                            }}
	                          />
	                          <div className="pointer-events-none absolute inset-0 z-20 rounded-full ring-1 ring-slate-300 dark:ring-slate-700" />
	                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900 dark:text-slate-100">{u.name}</div>
                          <div className="truncate text-xs text-slate-600 dark:text-slate-400">{u.email}</div>
                        </div>
                      </div>
	                    </td>
	                    <td className="px-3 py-2">
	                      <Pill variant="blue">{u.is_admin ? "Admin" : "User"}</Pill>
	                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {(formatAccess(u.access) || []).length ? (
                          formatAccess(u.access).map((label) => <Pill key={label}>{label}</Pill>)
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{formatCreated(u.created_at)}</td>
	                    <td className="px-3 py-2">
	                      <ActionMenu
	                        buttonVariant="ghost"
	                        items={[
	                          {
	                            label: "Edit",
	                            onClick: () => startEdit(u),
                            disabled: !perms.canEdit || (u.is_admin && !perms.isAdmin),
                          },
                          {
                            label: "Delete",
                            onClick: () => openDelete(u),
                            variant: "danger",
                            disabled: !perms.canDelete || (u.is_admin && !perms.isAdmin),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500 dark:text-slate-400" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <Pagination meta={pageMeta} onPageChange={(p) => setPage(p)} />
        </div>
      </div>

      <Modal
        open={formOpen}
        title={editing?.id ? "Edit user" : "New user"}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      >
        {editing ? (
          saving ? (
            <ModalSubmitting />
          ) : (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
              <div className="md:col-span-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter full name" required />
              </div>
              <div className="md:col-span-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Role</label>
                <DropdownSelect
                  options={ROLE_OPTIONS}
                  value={isAdmin ? "admin" : "user"}
                  onChange={(nextRole) => {
                    const nextIsAdmin = nextRole === "admin"
                    setIsAdmin(nextIsAdmin)
                    if (nextIsAdmin) ensureAdminDefaults(true)
                    else setAccess((prev) => normalizeAccess(prev, false))
                  }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Access Levels</label>
                <MultiSelect
                  options={ACCESS_OPTIONS}
                  value={access}
                  lockedValues={isAdmin ? ADMIN_DEFAULT_ACCESS : []}
                  disabledValues={access.includes("approver") ? ["view"] : []}
                  onChange={(next) => setAccess(normalizeAccess(next, isAdmin))}
                  placeholder="Select access levels…"
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2">
                <Button
                  variant="neutral"
                  type="button"
                  onClick={() => {
                    setFormOpen(false)
                    setEditing(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          )
        ) : null}
      </Modal>

      <Modal
        open={deleteOpen}
        title="Delete user"
        onClose={() => {
          setDeleteOpen(false)
          setDeleteUser(null)
        }}
      >
        {deleting ? (
          <ModalSubmitting />
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              Delete <span className="font-semibold text-slate-900 dark:text-slate-100">{deleteUser?.email}</span>? This action cannot be undone.
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="neutral"
                onClick={() => {
                  setDeleteOpen(false)
                  setDeleteUser(null)
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={remove}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
