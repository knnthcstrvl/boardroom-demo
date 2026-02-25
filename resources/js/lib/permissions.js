export function getPermissions(user) {
  const isAdmin = Boolean(user?.is_admin)
  const access = Array.isArray(user?.access) ? user.access.filter((v) => typeof v === "string") : []

  const has = (key) => isAdmin || access.includes(key)

  const canAdd = has("add")
  const canEdit = has("edit")
  const canDelete = has("delete")
  const canApprover = has("approver")
  const canView = has("view")

  const canUsers = isAdmin || canAdd || canEdit || canDelete
  const canReservations = isAdmin || canApprover || canView
  const anyAccess = isAdmin || access.length > 0
  const canDashboard = anyAccess
  const canSettings = anyAccess

  return {
    isAdmin,
    access,
    anyAccess,
    canDashboard,
    canUsers,
    canReservations,
    canSettings,
    canAdd,
    canEdit,
    canDelete,
    canApprover,
    canView,
  }
}
