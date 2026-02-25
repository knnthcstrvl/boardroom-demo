import React, { createContext, useContext, useMemo, useState } from "react"

const AdminSearchContext = createContext(null)

export function AdminSearchProvider({ children }) {
  const [query, setQuery] = useState("")

  const value = useMemo(() => ({ query, setQuery }), [query])

  return <AdminSearchContext.Provider value={value}>{children}</AdminSearchContext.Provider>
}

export function useAdminSearch() {
  const ctx = useContext(AdminSearchContext)
  if (!ctx) throw new Error("useAdminSearch must be used within <AdminSearchProvider>")
  return ctx
}

