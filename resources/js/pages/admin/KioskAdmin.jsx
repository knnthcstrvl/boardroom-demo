import React, { useEffect, useMemo, useRef, useState } from "react"
import axios from "../../lib/http"
import Button from "../../components/Button"
import Modal from "../../components/Modal"
import TableSkeleton from "../../components/TableSkeleton"
import { useToast } from "../../components/ToastProvider"
import ModalSubmitting from "../../components/ModalSubmitting"
import { createReservationStream } from "../../lib/reservationStream"
import { formatConflictMessage } from "../../lib/reservationErrors"
import { getPermissions } from "../../lib/permissions"
import Input from "../../components/Input"
import DropdownSelect from "../../components/DropdownSelect"
import Pagination from "../../components/Pagination"
import SortableTh from "../../components/SortableTh"
import FilterPopover from "../../components/FilterPopover"
import ActionMenu from "../../components/ActionMenu"
import { formatManilaDateTime } from "../../lib/manilaTime"
import ReservationWhen from "../../components/ReservationWhen"
import { withBasePath } from "../../lib/url"

function ArrowRightIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m13 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatDateTime(d) {
  return formatManilaDateTime(d)
}

	function StatusPill({ status }) {
	  const normalized = String(status || "").toLowerCase()
	  const styles =
	    normalized === "approved"
	      ? "border-brand-freshGreen/40 bg-brand-freshGreen/15 text-brand-freshGreen dark:border-brand-freshGreen/40 dark:bg-brand-freshGreen/20 dark:text-brand-freshGreen"
	      : normalized === "rejected"
	        ? "border-brand-flameRed/40 bg-brand-flameRed/10 text-brand-flameRed dark:border-brand-flameRed/40 dark:bg-brand-flameRed/15 dark:text-brand-flameRed"
	        : "border-brand-stone/30 bg-brand-stone/10 text-brand-stone dark:border-brand-stone/40 dark:bg-brand-stone/15 dark:text-brand-stone"

	  const label = normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : "-"
	  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${styles}`}>{label}</span>
	}

export default function KioskAdmin() {
  const perms = getPermissions(window.__AUTH_USER__)
  const [tab, setTab] = useState("pending") // pending | reviewed
  const [rows, setRows] = useState([])
  const [fetching, setFetching] = useState(false)
  const [loadingSkeleton, setLoadingSkeleton] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const loadInFlightRef = useRef(false)
  const loadRef = useRef(null)
  const queuedLoadOptionsRef = useRef(null)
  const nextLoadOptionsRef = useRef({ clear: true, showSkeleton: true })
  const prevSortRef = useRef({ sortBy: "created_at", sortDir: "desc" })
  const { push: pushToast } = useToast()
  const [pageMeta, setPageMeta] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // approve | reject
  const [confirmRow, setConfirmRow] = useState(null)
  const [rejectReason, setRejectReason] = useState("")
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)
  const confirmFromUrlRef = useRef(false)

  const [qInput, setQInput] = useState("")
  const [q, setQ] = useState("")
  const [date, setDate] = useState("")
  const [timeFrom, setTimeFrom] = useState("")
  const [timeTo, setTimeTo] = useState("")
  const [recurring, setRecurring] = useState("")
  const [title, setTitle] = useState("")
  const [requestedBy, setRequestedBy] = useState("")
  const [approvedBy, setApprovedBy] = useState("")
  const [statusReviewed, setStatusReviewed] = useState("")
  const [sortBy, setSortBy] = useState("created_at")
  const [sortDir, setSortDir] = useState("desc")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const perPageOptions = useMemo(() => {
    return [
      { value: 10, label: "10 / page" },
      { value: 25, label: "25 / page" },
      { value: 50, label: "50 / page" },
    ]
  }, [])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (date) count++
    if (timeFrom || timeTo) count++
    if (recurring !== "") count++
    if (title) count++
    if (requestedBy) count++
    if (approvedBy && tab === "reviewed") count++
    if (statusReviewed && tab === "reviewed") count++
    return count
  }, [date, timeFrom, timeTo, recurring, title, requestedBy, approvedBy, statusReviewed, tab])

  useEffect(() => {
    const id = window.setTimeout(() => setQ(qInput), 250)
    return () => window.clearTimeout(id)
  }, [qInput])

  useEffect(() => {
    setPage(1)
  }, [tab, q, date, timeFrom, timeTo, recurring, title, requestedBy, approvedBy, statusReviewed, sortBy, sortDir, perPage])

  function clearSort() {
    setSortBy("created_at")
    setSortDir("desc")
  }

  async function load({ clear, showRefreshSpinner, showSkeleton } = {}) {
    if (loadInFlightRef.current) {
      queuedLoadOptionsRef.current = { clear, showRefreshSpinner, showSkeleton }
      return
    }
    if (clear) {
      setRows([])
      setPageMeta(null)
    }
    if (showRefreshSpinner) setRefreshing(true)
    if (showSkeleton) setLoadingSkeleton(true)
    setFetching(true)
    loadInFlightRef.current = true
    try {
      const status =
        tab === "pending"
          ? ["pending"]
          : statusReviewed
            ? [statusReviewed]
            : ["approved", "rejected"]

	      const { data } = await axios.get("/api/reservations", {
	        params: {
	          status,
	          q: q || undefined,
	          date: date || undefined,
	          time_from: timeFrom || undefined,
	          time_to: timeTo || undefined,
	          // Laravel boolean validator accepts 0/1 (query params are strings).
	          recurring: recurring === "" ? undefined : recurring === "yes" ? 1 : 0,
	          title: title || undefined,
	          requested_by: requestedBy || undefined,
	          approved_by: tab === "reviewed" ? approvedBy || undefined : undefined,
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
        message: e?.response?.data?.message || "Failed to load reservations.",
      })
    } finally {
      setFetching(false)
      loadInFlightRef.current = false
      if (showRefreshSpinner) setRefreshing(false)
      if (showSkeleton) setLoadingSkeleton(false)

      if (queuedLoadOptionsRef.current) {
        const nextOpts = queuedLoadOptionsRef.current
        queuedLoadOptionsRef.current = null
        window.setTimeout(() => loadRef.current?.(nextOpts || {}), 0)
      }
    }
  }

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search || "")
    const action = params.get("confirm")
    const reservationId = params.get("reservation")
    if (!action || !reservationId) return
    if (action !== "approve" && action !== "reject") return
    if (!/^[0-9]+$/.test(String(reservationId))) return
    if (confirmFromUrlRef.current) return
    confirmFromUrlRef.current = true

    async function open() {
      try {
        setTab("pending")
        setPage(1)
        const { data } = await axios.get(`/api/reservations/${reservationId}`)
        setConfirmAction(action)
        setConfirmRow(data)
        setRejectReason("")
        setConfirmOpen(true)
      } catch {
        // ignore
      } finally {
        params.delete("confirm")
        params.delete("reservation")
        const next = params.toString()
        const base = window.location.pathname
        window.history.replaceState({}, "", next ? `${base}?${next}` : base)
      }
    }

    open()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let refreshTimer = null
    let suppressStreamRefresh = true
    const suppressId = window.setTimeout(() => {
      suppressStreamRefresh = false
    }, 1200)

    function scheduleRefresh() {
      if (suppressStreamRefresh) return
      if (refreshTimer) return
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        loadRef.current?.({ showSkeleton: false })
      }, 300)
    }

    const stream = createReservationStream()
    stream.addEventListener("reservation.changed", scheduleRefresh)

    const id = window.setInterval(() => loadRef.current?.({ showSkeleton: false }), 30000)

    return () => {
      stream.close()
      if (refreshTimer) window.clearTimeout(refreshTimer)
      window.clearInterval(id)
      window.clearTimeout(suppressId)
    }
  }, [])

  useEffect(() => {
    const nextOpts = nextLoadOptionsRef.current
    nextLoadOptionsRef.current = null
    const sortChanged = prevSortRef.current.sortBy !== sortBy || prevSortRef.current.sortDir !== sortDir
    prevSortRef.current = { sortBy, sortDir }
    load(nextOpts || (sortChanged ? { showSkeleton: true } : {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q, date, timeFrom, timeTo, recurring, title, requestedBy, approvedBy, statusReviewed, sortBy, sortDir, page, perPage])

  function openConfirm(action, row) {
    if (!perms.canApprover) return
    setConfirmAction(action)
    setConfirmRow(row)
    setRejectReason("")
    setConfirmOpen(true)
  }

  async function approve(id) {
    try {
      const { data } = await axios.post(`/api/reservations/${id}/approve`)
      await load()
      pushToast({ variant: "success", title: "Accepted", message: "Reservation accepted." })
      if (data?.auto_rejected) {
        pushToast({
          variant: "warning",
          title: "Other requests rejected",
          message: `${data.auto_rejected} overlapping pending reservation(s) were moved to Rejected.`,
        })
      }
    } catch (e) {
      const data = e?.response?.data
      const msg = data?.conflict ? formatConflictMessage(data) : data?.message || "Failed to approve."
      pushToast({ variant: "error", title: "Something went wrong", message: msg })
    }
  }

  async function reject(id) {
    try {
      await axios.post(`/api/reservations/${id}/reject`, { reason: rejectReason })
      await load()
      pushToast({ variant: "success", title: "Rejected", message: "Reservation rejected." })
    } catch (e) {
      const data = e?.response?.data
      const msg = data?.conflict ? formatConflictMessage(data) : data?.message || "Failed to reject."
      pushToast({ variant: "error", title: "Something went wrong", message: msg })
    }
  }

  async function confirm() {
    if (!confirmRow?.id || !confirmAction) return
    if (confirmSubmitting) return
    setConfirmSubmitting(true)
    try {
      if (confirmAction === "approve") {
        await approve(confirmRow.id)
      } else {
        await reject(confirmRow.id)
      }
      setConfirmOpen(false)
      setConfirmRow(null)
      setConfirmAction(null)
    } finally {
      setConfirmSubmitting(false)
    }
  }

  const tabs = [
    { key: "pending", label: "Pending" },
    { key: "reviewed", label: "Approved / Disapproved" },
  ]

  return (
    <div className="bg-transparent">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reservations</div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Review pending, approved, and disapproved meeting requests.</p>
        </div>
        <a
          href={withBasePath("/kiosk")}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 dark:bg-brand-secondary dark:text-slate-900 dark:hover:bg-brand-secondary/90"
        >
          <span>Go to Kiosk</span>
          <ArrowRightIcon className="h-4 w-4" />
        </a>
      </div>

      <div
        className="mt-6 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800"
        role="tablist"
        aria-label="Reservation status tabs"
      >
        <div className="flex items-center gap-8">
          {tabs.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  nextLoadOptionsRef.current = { clear: true, showSkeleton: true }
                  setTab(t.key)
                }}
                className={`-mb-px border-b-2 px-1 pb-3 text-sm font-semibold focus:outline-none ${
                  active
                    ? "border-brand-primary text-brand-primary dark:border-brand-secondary dark:text-brand-secondary"
                    : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <div className="h-1" />
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
	                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">Refine reservations.</div>
	              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Date</label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Time from</label>
                    <Input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Time to</label>
                    <Input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Recurring</label>
                  <DropdownSelect
                    options={[
                      { value: "", label: "All" },
                      { value: "yes", label: "Recurring only" },
                      { value: "no", label: "Not recurring" },
                    ]}
                    value={recurring}
                    onChange={(v) => setRecurring(v)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Title</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Filter by title..." />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Requested by</label>
                  <Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Name or email..." />
                </div>

                {tab === "reviewed" ? (
                  <>
                    <div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Approved by</label>
                      <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Name or email..." />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Status</label>
                      <DropdownSelect
                        options={[
                          { value: "", label: "All reviewed" },
                          { value: "approved", label: "Approved" },
                          { value: "rejected", label: "Disapproved" },
                        ]}
                        value={statusReviewed}
                        onChange={(v) => setStatusReviewed(v)}
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="neutral"
                  type="button"
                  onClick={() => {
                    setDate("")
                    setTimeFrom("")
                    setTimeTo("")
                    setRecurring("")
                    setTitle("")
                    setRequestedBy("")
                    setApprovedBy("")
                    setStatusReviewed("")
                  }}
                  disabled={
                    !date &&
                    !timeFrom &&
                    !timeTo &&
                    recurring === "" &&
                    !title &&
                    !requestedBy &&
                    !(tab === "reviewed" && approvedBy) &&
                    !(tab === "reviewed" && statusReviewed)
                  }
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
	        <div className="overflow-x-auto">
	          <table className="min-w-full table-auto text-sm">
	            <colgroup>
	              {tab === "reviewed" ? (
	                <>
	                  <col className="w-[22%]" />
	                  <col />
	                  <col className="w-[9%]" />
	                  <col className="w-[18%]" />
	                  <col className="w-[15%]" />
	                  <col className="w-[140px]" />
	                </>
	              ) : (
	                <>
	                  <col className="w-[24%]" />
	                  <col />
	                  <col className="w-[10%]" />
	                  <col className="w-[22%]" />
	                  <col className="w-[96px]" />
	                </>
	              )}
	            </colgroup>
	          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
	            <tr>
	              <SortableTh label="When" sortKey="start_at" sortBy={sortBy} sortDir={sortDir} onChange={(k, d) => (setSortBy(k), setSortDir(d))} onClear={clearSort} />
	              <SortableTh label="Title" sortKey="title" sortBy={sortBy} sortDir={sortDir} onChange={(k, d) => (setSortBy(k), setSortDir(d))} onClear={clearSort} />
	              <SortableTh
	                label="Type"
	                sortKey="recurring"
	                sortBy={sortBy}
	                sortDir={sortDir}
	                onChange={(k, d) => (setSortBy(k), setSortDir(d))}
	                onClear={clearSort}
	              />
	              <SortableTh
	                label="Requested by"
	                sortKey="requested_by"
	                sortBy={sortBy}
	                sortDir={sortDir}
	                onChange={(k, d) => (setSortBy(k), setSortDir(d))}
	                onClear={clearSort}
	              />
	              {tab === "reviewed" ? (
	                <SortableTh
	                  label="Approved by"
	                  sortKey="approved_by"
	                  sortBy={sortBy}
	                  sortDir={sortDir}
	                  onChange={(k, d) => (setSortBy(k), setSortDir(d))}
	                  onClear={clearSort}
	                />
	              ) : null}
	              {tab === "reviewed" ? (
	                <SortableTh
	                  label="Status"
	                  sortKey="status"
	                  sortBy={sortBy}
	                  sortDir={sortDir}
	                  onChange={(k, d) => (setSortBy(k), setSortDir(d))}
	                  onClear={clearSort}
	                />
	              ) : (
	                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Actions</th>
	              )}
            </tr>
          </thead>
	          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {loadingSkeleton ? (
              <TableSkeleton columns={tab === "reviewed" ? 6 : 5} rows={6} />
            ) : rows.length ? (
		              rows.map((r) => {
		                const isRecurring = Boolean(r?.repeat_enabled || r?.repeat_series_id)
		                const whenVariant = "primary"

                return (
                  <tr key={r.id}>
		                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
		                      <ReservationWhen reservation={r} variant={whenVariant} />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                      <span className="block min-w-0 truncate">{r.title}</span>
                      {tab === "reviewed" && r.status === "rejected" ? (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reason: {r.rejected_reason || "-"}</div>
                      ) : null}
                    </td>
	                    <td className="px-3 py-2 whitespace-nowrap">
	                      {isRecurring ? (
	                        <span className="inline-flex shrink-0 items-center rounded-full border border-brand-secondary/40 bg-brand-secondary/15 px-2 py-0.5 text-[11px] font-semibold text-brand-secondary dark:border-brand-secondary/40 dark:bg-brand-secondary/20">
	                          Recurring
	                        </span>
	                      ) : (
	                        <span className="inline-flex shrink-0 items-center rounded-full border border-brand-calmBlue/40 bg-brand-calmBlue/15 px-2 py-0.5 text-[11px] font-semibold text-brand-calmBlue dark:border-brand-calmBlue/40 dark:bg-brand-calmBlue/20">
	                          One-time
	                        </span>
	                      )}
	                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{r.requester_email || r.requester?.email}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{r.requester_department}</div>
                    </td>
                    {tab === "reviewed" ? (
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        <span className="block min-w-0 truncate">{r.approver?.email || "-"}</span>
                      </td>
                    ) : null}
	                    <td className="px-3 py-2 whitespace-nowrap">
	                      {tab === "pending" ? (
	                        <ActionMenu
	                          buttonVariant="ghost"
	                          items={[
	                            {
	                              label: "Accept",
	                              onClick: () => openConfirm("approve", r),
	                              disabled: !perms.canApprover,
	                            },
	                            {
	                              label: "Reject",
	                              onClick: () => openConfirm("reject", r),
	                              variant: "danger",
	                              disabled: !perms.canApprover,
	                            },
	                          ]}
	                        />
	                      ) : (
	                        <div className="text-slate-700 dark:text-slate-300">
	                          <StatusPill status={r.status} />
	                        </div>
	                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500 dark:text-slate-400" colSpan={tab === "reviewed" ? 6 : 5}>
                  No reservations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="mt-4">
        <Pagination meta={pageMeta} onPageChange={(p) => setPage(p)} />
      </div>

      <Modal
        open={confirmOpen}
        title={confirmAction === "approve" ? "Accept reservation" : "Reject reservation"}
        onClose={() => setConfirmOpen(false)}
      >
        {confirmRow ? (
          confirmSubmitting ? (
            <ModalSubmitting />
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{confirmRow.title}</div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {formatDateTime(confirmRow.start_at)} – {formatDateTime(confirmRow.end_at)}
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Requested by:{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {confirmRow.requester_email || confirmRow.requester?.email}
                  </span>
                </div>
              </div>

              {confirmAction === "reject" ? (
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Reason (optional)</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-primary/50 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Add a reason for rejection..."
                  />
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button variant="neutral" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant={confirmAction === "reject" ? "danger" : "primary"} onClick={confirm}>
                  {confirmAction === "approve" ? "Accept" : "Reject"}
                </Button>
              </div>
            </div>
          )
        ) : null}
      </Modal>
    </div>
  )
}
