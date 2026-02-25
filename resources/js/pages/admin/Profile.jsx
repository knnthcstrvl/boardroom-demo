import React, { useMemo, useState } from "react"
import axios from "../../lib/http"
import Button from "../../components/Button"
import Input from "../../components/Input"
import { useToast } from "../../components/ToastProvider"
import { getPermissions } from "../../lib/permissions"

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

export default function Profile() {
  const actor = window.__AUTH_USER__
  const perms = useMemo(() => getPermissions(actor), [actor])
  const { push: pushToast } = useToast()

  const [name, setName] = useState(String(actor?.name || ""))
  const [saving, setSaving] = useState(false)

  const avatarFallback = initials(actor?.name || actor?.email)
  const avatarUrl = actor?.id ? `/api/users/${actor.id}/avatar?v=3` : ""

  async function save(e) {
    e?.preventDefault?.()
    if (!actor?.id) return
    if (saving) return
    setSaving(true)
    try {
      const { data } = await axios.put(`/api/users/${actor.id}`, { name })
      window.__AUTH_USER__ = { ...actor, ...data }
      pushToast({ variant: "success", title: "Saved", message: "Profile updated. Refreshing…" })
      window.setTimeout(() => window.location.reload(), 350)
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to update profile."
      pushToast({ variant: "error", title: "Something went wrong", message: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-transparent">
      <div className="flex items-start gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-700">
          <div className="absolute inset-0 z-0 flex items-center justify-center text-lg font-bold text-slate-700 dark:text-slate-200">
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

        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage your account details.</div>
        </div>
      </div>

      <form className="mt-6 grid gap-4 md:max-w-xl" onSubmit={save}>
        <div>
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!perms.canEdit} />
          {!perms.canEdit ? (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">You don’t have permission to edit your profile.</div>
          ) : null}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Email</label>
          <Input value={actor?.email || ""} disabled />
        </div>

        {perms.canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
