import React, { useEffect, useMemo, useRef, useState } from "react"
import axios from "../lib/http"
import Button from "../components/Button"
import BrandMark from "../components/BrandMark"
import Input from "../components/Input"
import Select from "../components/Select"
import DropdownSelect from "../components/DropdownSelect"
import Modal from "../components/Modal"
import { useToast } from "../components/ToastProvider"
import ModalSubmitting from "../components/ModalSubmitting"
import { createReservationStream } from "../lib/reservationStream"
import { formatConflictMessage } from "../lib/reservationErrors"
import { getPermissions } from "../lib/permissions"
import { getStoredTheme, getEffectiveTheme, setTheme } from "../lib/theme"
import { withBasePath } from "../lib/url"
import {
  addDaysUtc,
  formatManilaDateTime,
  formatManilaTimeRange12,
  formatManilaWorkWeekRangeTitle,
  manilaDateKey,
  manilaInputValue,
  manilaMinutesSinceMidnight,
  manilaMonthShortDay,
  manilaParts,
  manilaSqlDateTime,
  manilaSqlFromInput,
  manilaWeekdayShort,
  setManilaTimeOnDay,
  startOfManilaDay,
  startOfManilaWorkWeek,
  utcMsFromManilaInput,
} from "../lib/manilaTime"

const START_HOUR = 7
const END_HOUR = 19
const TIME_COL_WIDTH = 88

function SunIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 18a6 6 0 1 0 0-12a6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatTimeRange12(start, end) {
  return formatManilaTimeRange12(start, end)
}

function toLocalInputValue(date) {
  return manilaInputValue(date)
}

function startOfWorkWeek(d) {
  return startOfManilaWorkWeek(d)
}

function startOfDayLocal(d) {
  return startOfManilaDay(d)
}

function addDays(d, days) {
  return addDaysUtc(d, days)
}

function formatRangeTitle(weekStart) {
  return formatManilaWorkWeekRangeTitle(weekStart)
}

function formatDateTime(d) {
  return formatManilaDateTime(d)
}

function minutesSinceMidnight(d) {
  return manilaMinutesSinceMidnight(d)
}

function roundToStep(value, step) {
  return Math.round(value / step) * step
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function statusPill(status) {
  const label = status ? `${String(status).charAt(0).toUpperCase()}${String(status).slice(1)}` : ""
  const styles =
    status === "approved"
      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-500/40"
    : status === "pending"
      ? "bg-brand-secondary/20 text-slate-900 ring-1 ring-brand-secondary/40 dark:bg-brand-secondary/25 dark:text-slate-100 dark:ring-brand-secondary/50"
    : status === "rejected"
      ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-500/20 dark:text-rose-100 dark:ring-rose-500/40"
      : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-100 dark:ring-slate-400/30"

  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium leading-4 ${styles}`}>
      {label}
    </span>
  )
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart
}

function computeOverlapLayout(items, rangeStartMin, rangeEndMin) {
  const events = items
    .map((r) => {
      const start = new Date(r.start_at)
      const end = new Date(r.end_at)
      return {
        r,
        startMin: minutesSinceMidnight(start),
        endMin: minutesSinceMidnight(end),
      }
    })
    .map((e) => ({
      ...e,
      startMinClamped: clamp(e.startMin, rangeStartMin, rangeEndMin),
      endMinClamped: clamp(e.endMin, rangeStartMin, rangeEndMin),
    }))
    .filter((e) => e.endMinClamped > e.startMinClamped)

  const n = events.length
  const adj = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (overlaps(events[i].startMinClamped, events[i].endMinClamped, events[j].startMinClamped, events[j].endMinClamped)) {
        adj[i].push(j)
        adj[j].push(i)
      }
    }
  }

  const visited = new Array(n).fill(false)
  const layouts = new Map()

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    const stack = [i]
    visited[i] = true
    const component = []

    while (stack.length) {
      const idx = stack.pop()
      component.push(idx)
      for (const next of adj[idx]) {
        if (!visited[next]) {
          visited[next] = true
          stack.push(next)
        }
      }
    }

    const componentEvents = component
      .map((idx) => ({ idx, ...events[idx] }))
      .sort((a, b) => a.startMinClamped - b.startMinClamped || b.endMinClamped - a.endMinClamped)

    const active = []
    const assigned = new Map()
    let maxCols = 0

    for (const ev of componentEvents) {
      for (let k = active.length - 1; k >= 0; k--) {
        if (active[k].endMinClamped <= ev.startMinClamped) {
          active.splice(k, 1)
        }
      }

      const used = new Set(active.map((a) => a.col))
      let col = 0
      while (used.has(col)) col++

      assigned.set(ev.idx, col)
      active.push({ endMinClamped: ev.endMinClamped, col })
      maxCols = Math.max(maxCols, col + 1)
    }

    for (const idx of component) {
      layouts.set(events[idx].r.id, { col: assigned.get(idx), cols: maxCols })
    }
  }

  return layouts
}

export default function Kiosk({ user }) {
  const calendarRef = useRef(null)
  const suppressOpenUntilRef = useRef(0)
  const touchRef = useRef(null)
  const cardTapRef = useRef({ id: null, t: 0 })
  const prefetchedWeekRef = useRef(null)
  const { push: pushToast } = useToast()
  const brand = window.__BRANDING__ || { name: "BoardRoom", logoUrl: "" }
  const calendarPanelRef = useRef(null)
  const calendarHeaderRef = useRef(null)
  const perms = useMemo(() => getPermissions(user), [user])
  const canEditReservations = perms.isAdmin || perms.canEdit
  const themeScope = "kiosk"
  const [effectiveTheme, setEffectiveTheme] = useState(() => getEffectiveTheme(getStoredTheme(themeScope)))
  const isDark = effectiveTheme === "dark"

  useEffect(() => {
    function onChanged(e) {
      const eventScope = e?.detail?.scope
      if (eventScope && eventScope !== themeScope) return
      const next = e?.detail?.effective || getEffectiveTheme(getStoredTheme(themeScope))
      setEffectiveTheme(next)
    }
    window.addEventListener("br.theme.changed", onChanged)
    return () => window.removeEventListener("br.theme.changed", onChanged)
  }, [])

  const [hourHeight, setHourHeight] = useState(96)

  const [meetingRooms, setMeetingRooms] = useState([])
  const [meetingRoomId, setMeetingRoomId] = useState("")
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [reservations, setReservations] = useState([])
  const [slideStage, setSlideStage] = useState("idle") // idle | prepare | animate
  const [slideDir, setSlideDir] = useState(null) // prev | next
  const [incomingWeekStart, setIncomingWeekStart] = useState(null)
  const [incomingReservations, setIncomingReservations] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState("create") // create | view
  const [modalReservationId, setModalReservationId] = useState(null)
  const [modalTitle, setModalTitle] = useState("")
  const [modalStart, setModalStart] = useState("")
  const [modalEnd, setModalEnd] = useState("")
  const [modalEmail, setModalEmail] = useState("")
  const [modalDepartment, setModalDepartment] = useState("")
  const [modalAttendees, setModalAttendees] = useState("")
  const [modalRecurring, setModalRecurring] = useState(false)
  const [modalRecurringDays, setModalRecurringDays] = useState([]) // weekday numbers (1=Mon..5=Fri)
  const [modalRepeatEvery, setModalRepeatEvery] = useState(1)
  const [modalRepeatUnit, setModalRepeatUnit] = useState("week") // week | month
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [repeatDraftDays, setRepeatDraftDays] = useState([]) // weekday numbers (1=Mon..5=Fri)
  const [repeatDraftStartDate, setRepeatDraftStartDate] = useState("") // YYYY-MM-DD
  const [repeatDraftEvery, setRepeatDraftEvery] = useState(1)
  const [repeatDraftUnit, setRepeatDraftUnit] = useState("week") // week | month
  const [dragging, setDragging] = useState(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [modalApproving, setModalApproving] = useState(false)
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [decisionAction, setDecisionAction] = useState(null) // accept | reject
  const [decisionReason, setDecisionReason] = useState("")

  function invalidatePrefetch() {
    prefetchedWeekRef.current = null
  }

  const selectedReservation = useMemo(() => {
    if (!modalReservationId) return null
    return reservations.find((r) => r.id === modalReservationId) || null
  }, [modalReservationId, reservations])

  const isApprover = useMemo(() => {
    if (!user) return false
    if (user.is_admin) return true
    const access = user.access || []
    return Array.isArray(access) && access.includes("approver")
  }, [user])

  const [weekStart, setWeekStart] = useState(() => startOfWorkWeek(new Date()))
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const allowInteraction = slideStage === "idle" && !incomingWeekStart

  const hourRows = useMemo(() => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i), [])

  const departments = useMemo(
    () => [
      "Academic Department",
      "Admissions and Financial Aid Department",
      "Campus Development Department",
      "Executive Vice Chair",
      "Executive Vice President",
      "External Affairs Office",
      "Finance Department",
      "Human Resource Department",
      "Information Technology Department",
      "Institutional Research Office",
      "Internal Audit Office",
      "Lead Institute",
      "Library Services Department",
      "Marketing Department",
      "Office of the President",
      "Office of the Registrar",
      "Quality Assurance Office",
      "Research Ethics Office",
      "Student Affairs Services",
    ],
    []
  )

  const meetingRoomOptions = useMemo(
    () => (meetingRooms || []).map((r) => ({ value: String(r.id), label: r.name })),
    [meetingRooms]
  )

  const departmentOptions = useMemo(() => departments.map((d) => ({ value: d, label: d })), [departments])

  async function loadMeetingRooms() {
    setRoomsLoading(true)
    const { data } = await axios.get("/api/meeting-rooms")
    setMeetingRooms(data)
    if (!meetingRoomId && data.length) {
      const preferred = data.find((r) => String(r.name).toLowerCase() === "board room")
      const picked = preferred || data[0]
      const nextId = String(picked.id)
      setMeetingRoomId(nextId)

      const start = startOfDayLocal(weekStart)
      const end = addDays(start, 5)
      fetchReservations(nextId, start, end)
        .then((rows) => {
          if (!Array.isArray(rows)) return
          const prefetchKey = `${nextId}|${manilaDateKey(start)}`
          prefetchedWeekRef.current = { key: prefetchKey, data: rows }
          setReservations(rows)
        })
        .catch(() => {})
    }
    setRoomsLoading(false)
  }

  async function fetchReservations(roomId, start, end) {
    if (!roomId) return null
    const { data } = await axios.get("/api/reservations", {
      params: { meeting_room_id: roomId, start: manilaSqlDateTime(start), end: manilaSqlDateTime(end), status: ["pending", "approved"] },
    })
    return data
  }

  async function loadReservations(roomId, start, end) {
    const data = await fetchReservations(roomId, start, end)
    if (Array.isArray(data)) {
      setReservations(data)
    }
    return data
  }

  useEffect(() => {
    function recalc() {
      const panelEl = calendarPanelRef.current
      const headerEl = calendarHeaderRef.current
      if (!panelEl || !headerEl) return

      const panelHeight = panelEl.getBoundingClientRect().height
      const headerHeight = headerEl.getBoundingClientRect().height
      const available = Math.max(320, panelHeight - headerHeight)
      const next = Math.floor(available / hourRows.length)
      setHourHeight(clamp(next, 28, 56))
    }

    recalc()
    window.addEventListener("resize", recalc)
    return () => window.removeEventListener("resize", recalc)
  }, [hourRows.length])

  useEffect(() => {
    loadMeetingRooms()
      .catch((e) =>
        pushToast({
          variant: "error",
          title: "Something went wrong",
          message: e?.response?.data?.message || "Failed to load meeting rooms.",
        })
      )
      .finally(() => setRoomsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const start = startOfDayLocal(weekStart)
    const end = addDays(start, 5)
    const prefetchKey = `${meetingRoomId}|${manilaDateKey(start)}`
    if (prefetchedWeekRef.current?.key === prefetchKey && Array.isArray(prefetchedWeekRef.current?.data)) {
      setReservations(prefetchedWeekRef.current.data)
      prefetchedWeekRef.current = null
      return
    }

    loadReservations(meetingRoomId, start, end).catch((e) =>
      pushToast({
        variant: "error",
        title: "Something went wrong",
        message: e?.response?.data?.message || "Failed to load reservations.",
      })
    )
  }, [meetingRoomId, weekStart])

  useEffect(() => {
    if (!meetingRoomId) return

    let refreshTimer = null
    function scheduleRefresh() {
      if (refreshTimer) return
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        refresh()
      }, 250)
    }

    function refresh() {
      if (document.visibilityState !== "visible") return
      const start = startOfDayLocal(weekStart)
      const end = addDays(start, 5)
      loadReservations(meetingRoomId, start, end).catch(() => {})
    }

    const stream = createReservationStream({ meetingRoomId })
    stream.addEventListener("reservation.changed", scheduleRefresh)
    stream.onerror = () => {
      // SSE can be blocked by some proxies; keep a slower fallback poll.
    }

    const id = window.setInterval(refresh, 30000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)

    return () => {
      stream.close()
      window.clearInterval(id)
      if (refreshTimer) window.clearTimeout(refreshTimer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [meetingRoomId, weekStart])

  function weekKey(d) {
    return manilaDateKey(d)
  }

  function startSlide(targetWeekStart, dir) {
    if (!meetingRoomId) {
      setWeekStart(targetWeekStart)
      return
    }
    if (incomingWeekStart || slideStage !== "idle") return

    setSlideDir(dir)
    setSlideStage("prepare")
    setIncomingWeekStart(targetWeekStart)
    setIncomingReservations(null)

    const start = startOfDayLocal(targetWeekStart)
    const end = addDays(start, 5)
    fetchReservations(meetingRoomId, start, end)
      .then((data) => {
        if (Array.isArray(data)) {
          setIncomingReservations(data)
          prefetchedWeekRef.current = { key: `${meetingRoomId}|${weekKey(targetWeekStart)}`, data }
        }
      })
      .catch(() => {})

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSlideStage("animate")
      })
    })
  }

  function goPrevWeek() {
    suppressOpenUntilRef.current = Date.now() + 700
    startSlide(addDays(weekStart, -7), "prev")
  }

  function goNextWeek() {
    suppressOpenUntilRef.current = Date.now() + 700
    startSlide(addDays(weekStart, 7), "next")
  }

  function onSlideEnd() {
    if (!incomingWeekStart) return
    setWeekStart(incomingWeekStart)
    if (Array.isArray(incomingReservations)) {
      setReservations(incomingReservations)
    }
    setIncomingWeekStart(null)
    setIncomingReservations(null)
    setSlideStage("idle")
    setSlideDir(null)
  }

  function weekdayLabel(n) {
    return n === 1 ? "M" : n === 2 ? "T" : n === 3 ? "W" : n === 4 ? "TH" : n === 5 ? "F" : ""
  }

  function weekdayName(n) {
    return n === 1 ? "Mon" : n === 2 ? "Tue" : n === 3 ? "Wed" : n === 4 ? "Thu" : n === 5 ? "Fri" : ""
  }

  function formatRepeatSummary() {
    if (!modalRecurring) return "Does not repeat"
    const set = new Set(modalRecurringDays || [])
    const sorted = Array.from(set).filter((n) => n >= 1 && n <= 5).sort((a, b) => a - b)
    const every = modalRepeatEvery && Number.isFinite(Number(modalRepeatEvery)) ? Math.max(1, Number(modalRepeatEvery)) : 1
    const unit = modalRepeatUnit === "month" ? "month" : "week"
    const base =
      unit === "month"
        ? every > 1
          ? `Repeats every ${every} months`
          : "Repeats monthly"
        : every > 1
          ? `Repeats every ${every} weeks`
          : "Repeats weekly"
    if (!sorted.length) return base
    return `${base} on ${sorted.map(weekdayName).join(", ")}`
  }

  function openRepeatModal() {
    setRepeatDraftDays(Array.from(new Set(modalRecurringDays || [])))
    setRepeatDraftStartDate(modalStart ? modalStart.slice(0, 10) : "")
    setRepeatDraftEvery(modalRepeatEvery || 1)
    setRepeatDraftUnit(modalRepeatUnit || "week")
    setRepeatOpen(true)
  }

  function saveRepeatModal() {
    const every = Number.parseInt(String(repeatDraftEvery || 1), 10)
    if (!Number.isFinite(every) || every < 1) {
      pushToast({ variant: "warning", title: "Invalid repeat", message: "Repeat every must be 1 or more." })
      return
    }

    if (!repeatDraftStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(repeatDraftStartDate)) {
      pushToast({ variant: "warning", title: "Invalid start", message: "Choose a valid start date." })
      return
    }
    const todayStr = manilaDateKey(new Date())
    if (repeatDraftStartDate < todayStr) {
      pushToast({ variant: "warning", title: "Not allowed", message: "Recurring meetings can't start in the past." })
      return
    }

    const set = new Set(repeatDraftDays || [])
    const next = Array.from(set).filter((n) => n >= 1 && n <= 5).sort((a, b) => a - b)
    if (!next.length) {
      pushToast({ variant: "warning", title: "Select day(s)", message: "Choose at least one day for the recurring meeting." })
      return
    }

    // Apply picked start date to Start/End fields (keep times)
    const currentStartMs = utcMsFromManilaInput(modalStart)
    const currentEndMs = utcMsFromManilaInput(modalEnd)
    if (!Number.isFinite(currentStartMs) || !Number.isFinite(currentEndMs)) {
      pushToast({ variant: "error", title: "Something went wrong", message: "Invalid start/end date." })
      return
    }
    const startP = manilaParts(currentStartMs)
    const endP = manilaParts(currentEndMs)
    const pickedMs = utcMsFromManilaInput(`${repeatDraftStartDate}T00:00`)
    if (!Number.isFinite(pickedMs)) {
      pushToast({ variant: "error", title: "Something went wrong", message: "Invalid start date." })
      return
    }
    const pickedDay = new Date(pickedMs)
    const nextStart = setManilaTimeOnDay(pickedDay, startP.hour, startP.minute)
    const nextEnd = setManilaTimeOnDay(pickedDay, endP.hour, endP.minute)

    setModalStart(toLocalInputValue(nextStart))
    setModalEnd(toLocalInputValue(nextEnd))
    setWeekStart(startOfWorkWeek(nextStart))

    setModalRecurring(true)
    setModalRecurringDays(next)
    setModalRepeatEvery(every)
    setModalRepeatUnit(repeatDraftUnit)
    setRepeatOpen(false)
  }

  function openNewReservation(day, hour) {
    const todayStart = startOfDayLocal(new Date())
    const dayStart = startOfDayLocal(day)
    if (dayStart < todayStart) {
      pushToast({ variant: "warning", title: "Not allowed", message: "You can't reserve a meeting in the past." })
      return
    }

    const start = setManilaTimeOnDay(day, hour, 0)
    if (start < new Date()) {
      pushToast({ variant: "warning", title: "Not allowed", message: "You can't reserve a meeting in the past." })
      return
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const weekday = ((manilaParts(start).weekday + 6) % 7) + 1 // 1=Mon..7=Sun
    const weekdayClamped = clamp(weekday, 1, 5)

    setModalMode("create")
    setModalReservationId(null)
    setModalTitle("")
    setModalEmail("")
    setModalDepartment("")
    setModalAttendees("")
    setModalRecurring(false)
    setModalRecurringDays([weekdayClamped])
    setModalRepeatEvery(1)
    setModalRepeatUnit("week")
    setModalStart(toLocalInputValue(start))
    setModalEnd(toLocalInputValue(end))
    setModalOpen(true)
  }

  function openViewReservation(r) {
    setModalMode("view")
    setModalReservationId(r.id)
    setModalTitle(r.title || "")
    setModalEmail(r.requester_email || r.requester?.email || "")
    setModalDepartment(r.requester_department || "")
    setModalAttendees(r.requester_attendees ? String(r.requester_attendees) : "")
    const rStart = new Date(r.start_at)
    const weekday = ((manilaParts(rStart).weekday + 6) % 7) + 1
    const weekdayClamped = clamp(weekday, 1, 5)
    const repeatEnabled = Boolean(r.repeat_enabled || r.repeat_series_id)
    setModalRecurring(repeatEnabled)
    setModalRecurringDays(
      repeatEnabled && Array.isArray(r.repeat_days) && r.repeat_days.length
        ? r.repeat_days.map((n) => clamp(Number(n), 1, 5)).filter((n) => Number.isFinite(n))
        : [weekdayClamped]
    )
    setModalRepeatEvery(repeatEnabled && r.repeat_weeks ? Number(r.repeat_weeks) : 1)
    setModalRepeatUnit(repeatEnabled && r.repeat_unit ? String(r.repeat_unit) : "week")

    const end = new Date(r.end_at)
    setModalStart(toLocalInputValue(rStart))
    setModalEnd(toLocalInputValue(end))
    setModalOpen(true)
  }

  function maybeOpenReservationDetails(e, r) {
    if (!allowInteraction) return
    if (Date.now() < suppressOpenUntilRef.current) return
    if (dragging?.reservationId === r.id && dragging?.started) return
    openViewReservation(r)
  }

  async function submitReservation(e) {
    e.preventDefault()
    if (modalSubmitting) return
    setModalSubmitting(true)

    try {
      if (!modalDepartment) {
        pushToast({ variant: "warning", title: "Select department", message: "Choose a department." })
        return
      }

      const baseStartMs = utcMsFromManilaInput(modalStart)
      const baseEndMs = utcMsFromManilaInput(modalEnd)
      if (!Number.isFinite(baseStartMs) || !Number.isFinite(baseEndMs)) {
        pushToast({ variant: "warning", title: "Invalid date", message: "Choose a valid start and end." })
        return
      }
      if (baseStartMs < Date.now()) {
        pushToast({ variant: "warning", title: "Not allowed", message: "You can't reserve a meeting in the past." })
        return
      }

      const payload = {
        meeting_room_id: Number(meetingRoomId),
        title: modalTitle,
        email: modalEmail,
        department: modalDepartment,
        attendees: modalAttendees === "" ? undefined : Number(modalAttendees),
        start_at: manilaSqlFromInput(modalStart),
        end_at: manilaSqlFromInput(modalEnd),
        repeat: modalRecurring
          ? {
              enabled: true,
              unit: modalRepeatUnit || "week",
              weeks: Number(modalRepeatEvery || 1),
              days: Array.from(new Set(modalRecurringDays || [])).map((n) => Number(n)),
              start_date: modalStart ? modalStart.slice(0, 10) : undefined,
            }
          : { enabled: false },
      }

      const { data } = await axios.post("/api/reservations", payload)
      const createdCount = Number(data?.created || (data?.id ? 1 : 1))

      setModalOpen(false)
      invalidatePrefetch()
      pushToast({
        variant: "success",
        title: "Submitted",
        message: createdCount > 1 ? `Submitted ${createdCount} reservations for approval.` : "Reservation sent for approval.",
      })

      const start = startOfDayLocal(weekStart)
      const end = addDays(start, 5)
      await loadReservations(meetingRoomId, start, end)
    } catch (err) {
      const data = err?.response?.data
      const msg = data?.conflict ? formatConflictMessage(data) : data?.message || "Failed to submit reservation."
      pushToast({ variant: "error", title: "Something went wrong", message: msg })
    } finally {
      setModalSubmitting(false)
    }
  }

  async function saveEdits(e) {
    e.preventDefault()
    if (!modalReservationId) return
    if (modalSubmitting) return
    if (!canEditReservations) {
      pushToast({ variant: "warning", title: "Not allowed", message: "You don't have access to edit reservations." })
      return
    }
    setModalSubmitting(true)

    try {
      if (!modalDepartment) {
        pushToast({ variant: "warning", title: "Select department", message: "Choose a department." })
        return
      }

      const baseStartMs = utcMsFromManilaInput(modalStart)
      const baseEndMs = utcMsFromManilaInput(modalEnd)
      if (!Number.isFinite(baseStartMs) || !Number.isFinite(baseEndMs)) {
        pushToast({ variant: "warning", title: "Invalid date", message: "Choose a valid start and end." })
        return
      }
      if (baseStartMs < Date.now()) {
        pushToast({ variant: "warning", title: "Not allowed", message: "You can't reserve a meeting in the past." })
        return
      }

      await axios.put(`/api/reservations/${modalReservationId}`, {
        title: modalTitle,
        email: modalEmail,
        department: modalDepartment,
        attendees: modalAttendees === "" ? undefined : Number(modalAttendees),
        start_at: manilaSqlFromInput(modalStart),
        end_at: manilaSqlFromInput(modalEnd),
        repeat: modalRecurring
          ? {
              enabled: true,
              unit: modalRepeatUnit || "week",
              weeks: Number(modalRepeatEvery || 1),
              days: Array.from(new Set(modalRecurringDays || [])).map((n) => Number(n)),
              start_date: modalStart ? modalStart.slice(0, 10) : undefined,
            }
          : { enabled: false },
      })

      setModalOpen(false)
      invalidatePrefetch()
      pushToast({
        variant: "success",
        title: "Saved",
        message: "Reservation updated.",
      })

      const start = startOfDayLocal(weekStart)
      const end = addDays(start, 5)
      await loadReservations(meetingRoomId, start, end)
    } catch (err) {
      const data = err?.response?.data
      const msg =
        err?.response?.status === 403
          ? data?.message || "You don't have access to edit reservations."
          : data?.conflict
            ? formatConflictMessage(data)
            : data?.message || "Failed to update reservation."
      pushToast({ variant: "error", title: "Something went wrong", message: msg })
    } finally {
      setModalSubmitting(false)
    }
  }

  async function approveSelectedReservation() {
    if (!selectedReservation?.id) return
    if (modalApproving) return
    setModalApproving(true)
    try {
      const { data } = await axios.post(`/api/reservations/${selectedReservation.id}/approve`)
      setModalOpen(false)
      setDecisionOpen(false)
      invalidatePrefetch()
      pushToast({ variant: "success", title: "Accepted", message: "Reservation accepted." })
      if (data?.auto_rejected) {
        pushToast({
          variant: "warning",
          title: "Other requests rejected",
          message: `${data.auto_rejected} overlapping pending reservation(s) were moved to Rejected.`,
        })
      }
      const start = startOfDayLocal(weekStart)
      const end = addDays(start, 5)
      await loadReservations(meetingRoomId, start, end)
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to approve reservation."
      pushToast({ variant: "error", title: "Something went wrong", message: msg })
    } finally {
      setModalApproving(false)
    }
  }

  async function rejectSelectedReservation() {
    if (!selectedReservation?.id) return
    if (modalApproving) return
    setModalApproving(true)
    try {
      await axios.post(`/api/reservations/${selectedReservation.id}/reject`, {
        reason: decisionReason || undefined,
      })
      setModalOpen(false)
      setDecisionOpen(false)
      invalidatePrefetch()
      pushToast({ variant: "success", title: "Rejected", message: "Reservation rejected." })
      const start = startOfDayLocal(weekStart)
      const end = addDays(start, 5)
      await loadReservations(meetingRoomId, start, end)
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to disapprove reservation."
      pushToast({ variant: "error", title: "Something went wrong", message: msg })
    } finally {
      setModalApproving(false)
    }
  }

  function openDecision(action) {
    if (!selectedReservation?.id) return
    if (!isApprover) return
    setDecisionAction(action)
    setDecisionReason("")
    setDecisionOpen(true)
  }

  async function confirmDecision() {
    if (!decisionAction) return
    if (decisionAction === "accept") {
      await approveSelectedReservation()
    } else {
      await rejectSelectedReservation()
    }
  }

  useEffect(() => {
    if (!dragging) return

    function onMove(e) {
      const el = calendarRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const dayWidth = (rect.width - TIME_COL_WIDTH) / 5
      const x = e.clientX - rect.left - TIME_COL_WIDTH
      const previewDayIndex = clamp(Math.floor(x / dayWidth), 0, 4)
      const y = e.clientY - rect.top

      setDragging((current) => {
        if (!current) return current
        const dx = Math.abs(e.clientX - current.startClientX)
        const dy = Math.abs(e.clientY - current.startClientY)
        const started = current.started || dx > 4 || dy > 4
        if (!started) {
          return current
        }

        const nextTop = y - current.grabOffsetY
        return { ...current, started: true, previewTop: nextTop, previewDayIndex }
      })
    }

    async function onUp(e) {
      const current = dragging
      setDragging(null)
      if (!current) return

      if (!current.started) {
        return
      }

      suppressOpenUntilRef.current = Date.now() + 700

      const totalMinutes = (END_HOUR - START_HOUR) * 60
      const rawMinutes = (current.previewTop / hourHeight) * 60
      const snapped = roundToStep(rawMinutes, 30)
      const startOffset = clamp(snapped, 0, totalMinutes - current.durationMinutes)

      const targetDay = days[current.previewDayIndex ?? 0] || days[0]
      const start = new Date(setManilaTimeOnDay(targetDay, START_HOUR, 0).getTime() + startOffset * 60000)
      const end = new Date(start.getTime() + current.durationMinutes * 60 * 1000)
      if (start < new Date()) {
        pushToast({ variant: "warning", title: "Not allowed", message: "You can't move a meeting to the past." })
        return
      }

	      try {
	        const { data } = await axios.post(`/api/reservations/${current.reservationId}/reschedule`, {
	          start_at: manilaSqlDateTime(start),
	          end_at: manilaSqlDateTime(end),
	        })

        invalidatePrefetch()
        const seriesUpdated = Number(data?.series_updated || 1)
        pushToast({
          variant: "success",
          title: "Updated",
          message:
            seriesUpdated > 1
              ? `Rescheduled ${seriesUpdated} recurring reservations (still pending approval).`
              : "Reservation rescheduled (still pending approval).",
        })
        const startRange = startOfDayLocal(weekStart)
        const endRange = addDays(startRange, 5)
        await loadReservations(meetingRoomId, startRange, endRange)
      } catch (e) {
        const data = e?.response?.data
        const msg =
          e?.response?.status === 403
            ? data?.message || "You don't have access to edit reservations."
            : data?.conflict
              ? formatConflictMessage(data)
              : data?.message || "Failed to reschedule reservation."
        pushToast({ variant: "error", title: "Something went wrong", message: msg })
      }
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp, { once: true })
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, hourHeight, days, meetingRoomId, weekStart])

  function buildReservationsByDay(weekDays, list) {
    const map = new Map()
    for (const d of weekDays) {
      map.set(manilaDateKey(d), [])
    }
    for (const r of list || []) {
      const key = manilaDateKey(r.start_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return map
  }

  function renderEventsForDayGeneric(day, weekDays, reservationsByDay, list, draggingState) {
    const items = reservationsByDay.get(manilaDateKey(day)) || []

    const rendered = []
    const totalMinutes = (END_HOUR - START_HOUR) * 60
    const rangeStartMin = START_HOUR * 60
    const rangeEndMin = END_HOUR * 60
    const layout = computeOverlapLayout(items, rangeStartMin, rangeEndMin)

    const localDraggingReservation = draggingState ? (list || []).find((r) => r.id === draggingState.reservationId) || null : null
    const draggingSeriesId =
      draggingState?.started && localDraggingReservation?.repeat_series_id ? String(localDraggingReservation.repeat_series_id) : null

    let seriesDeltaMs = 0
    let seriesPreviewStart = null
    if (draggingSeriesId && localDraggingReservation && draggingState) {
      const previewDay = weekDays[draggingState.previewDayIndex ?? 0] || weekDays[0]
      const rawMinutes = (clamp(draggingState.previewTop, 0, hourRows.length * hourHeight) / hourHeight) * 60
      const snapped = roundToStep(rawMinutes, 30)
      const startOffset = clamp(snapped, 0, totalMinutes - draggingState.durationMinutes)
      const previewStart = new Date(setManilaTimeOnDay(previewDay, START_HOUR, 0).getTime() + startOffset * 60000)
      seriesPreviewStart = previewStart
      seriesDeltaMs = previewStart.getTime() - new Date(localDraggingReservation.start_at).getTime()
    }

    const previewRenderedIds = new Set()

    for (const r of items) {
      if (draggingSeriesId && String(r.repeat_series_id || "") === draggingSeriesId && r.id !== draggingState?.reservationId) {
        const originalStart = new Date(r.start_at)
        const nextStart = new Date(originalStart.getTime() + seriesDeltaMs)
        if (manilaDateKey(nextStart) !== manilaDateKey(day)) {
          continue
        }
        const nextEnd = new Date(nextStart.getTime() + draggingState.durationMinutes * 60 * 1000)

        const startMin = minutesSinceMidnight(nextStart)
        const endMin = minutesSinceMidnight(nextEnd)
        const topMin = clamp(startMin, rangeStartMin, rangeEndMin) - rangeStartMin
        const bottomMin = clamp(endMin, rangeStartMin, rangeEndMin) - rangeStartMin
        const heightMin = Math.max(20, bottomMin - topMin)

        const top = (topMin / 60) * hourHeight
        const height = (heightMin / 60) * hourHeight

        const status = r.status
        const color =
          status === "approved"
            ? "bg-emerald-500/15 ring-1 ring-emerald-500/30"
            : status === "pending"
            ? "bg-brand-secondary/25 ring-1 ring-brand-secondary/60"
            : status === "rejected"
            ? "bg-rose-500/15 ring-1 ring-rose-500/30"
            : "bg-slate-500/10 ring-1 ring-slate-300"

        const timeLabel = formatTimeRange12(nextStart, nextEnd)

        previewRenderedIds.add(r.id)
        rendered.push(
          <div
            key={`series-preview-${r.id}`}
            className={`pointer-events-none absolute overflow-hidden rounded-lg px-2 py-1 ${color} transition-[top,left] duration-150 ease-out`}
            style={{ top, height, left: "4px", right: "4px", opacity: 0.6 }}
            title={`${r.title} (${status})`}
          >
            <div className="relative pr-16">
              <div className="min-w-0 truncate text-xs font-semibold leading-4 text-slate-900 dark:text-slate-100">{r.title}</div>
              <div className="mt-0.5 truncate text-[11px] leading-4 text-slate-700 dark:text-slate-200">{timeLabel}</div>
              {r.requester_department ? (
                <div className="mt-0.5 truncate text-[10px] leading-3 text-slate-700 dark:text-slate-200">{r.requester_department}</div>
              ) : null}
              <div className="absolute right-1 top-1">{statusPill(status)}</div>
            </div>
          </div>
        )
        continue
      }

      if (draggingState && r.id === draggingState.reservationId) {
        const previewDay = weekDays[draggingState.previewDayIndex ?? 0]
        if (previewDay && manilaDateKey(previewDay) !== manilaDateKey(day)) {
          continue
        }
      }

      const start = new Date(r.start_at)
      const end = new Date(r.end_at)

      const startMin = minutesSinceMidnight(start)
      const endMin = minutesSinceMidnight(end)
      const topMin = clamp(startMin, rangeStartMin, rangeEndMin) - rangeStartMin
      const bottomMin = clamp(endMin, rangeStartMin, rangeEndMin) - rangeStartMin
      const heightMin = Math.max(20, bottomMin - topMin)

      const status = r.status
      const color =
        status === "approved"
          ? "bg-emerald-500/15 ring-1 ring-emerald-500/30"
          : status === "pending"
          ? "bg-brand-secondary/25 ring-1 ring-brand-secondary/60"
          : status === "rejected"
          ? "bg-rose-500/15 ring-1 ring-rose-500/30"
          : "bg-slate-500/10 ring-1 ring-slate-300"

      const top = (topMin / 60) * hourHeight
      const height = (heightMin / 60) * hourHeight

      const timeLabel = formatTimeRange12(start, end)
      const durationMinutes = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000))

      const canDrag = allowInteraction && r.status === "pending" && canEditReservations

      const isDragging = draggingState && draggingState.reservationId === r.id
      const dragTop = isDragging ? clamp(draggingState.previewTop, 0, hourRows.length * hourHeight - height) : top
      const { col = 0, cols = 1 } = layout.get(r.id) || {}
      const left = `calc(${(col / cols) * 100}% + 4px)`
      const right = `calc(${((cols - col - 1) / cols) * 100}% + 4px)`

      let displayTimeLabel = timeLabel
      if (isDragging && draggingState?.started) {
        const rawMinutes = (dragTop / hourHeight) * 60
        const snapped = roundToStep(rawMinutes, 30)
        const startOffset = clamp(snapped, 0, totalMinutes - durationMinutes)
        const previewStart = new Date(setManilaTimeOnDay(day, START_HOUR, 0).getTime() + startOffset * 60000)
        const previewEnd = new Date(previewStart.getTime() + durationMinutes * 60 * 1000)
        displayTimeLabel = formatTimeRange12(previewStart, previewEnd)
      }

      rendered.push(
        <div
          key={r.id}
          className={`pointer-events-auto absolute overflow-hidden rounded-lg px-2 py-1 ${color}`}
          style={{
            top: dragTop,
            height,
            left,
            right,
            cursor: canDrag ? (isDragging && draggingState?.started ? "grabbing" : "grab") : "default",
            opacity: isDragging && draggingState?.started ? 0.85 : 1,
          }}
          title={`${r.title} (${status})`}
          data-reservation-card="true"
          onPointerDown={
            canDrag
              ? (e) => {
                  e.preventDefault()
                  e.stopPropagation()

                  const targetRect = e.currentTarget.getBoundingClientRect()
                  const grabOffsetY = e.clientY - targetRect.top
                  const dayIndex = clamp(weekDays.findIndex((d) => manilaDateKey(d) === manilaDateKey(day)), 0, 4)

                  setDragging({
                    reservationId: r.id,
                    durationMinutes,
                    grabOffsetY,
                    previewTop: top,
                    previewDayIndex: dayIndex,
                    started: false,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                  })
                }
              : undefined
          }
          onClick={(e) => {
            e.stopPropagation()
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            maybeOpenReservationDetails(e, r)
          }}
          onPointerUp={(e) => {
            // Mobile/tablet-friendly: emulate double-click via double-tap.
            if (e.pointerType !== "touch" && e.pointerType !== "pen") return
            e.stopPropagation()
            const now = Date.now()
            const last = cardTapRef.current
            const same = last.id === r.id && now - last.t < 350
            cardTapRef.current = { id: r.id, t: now }
            if (!same) return
            maybeOpenReservationDetails(e, r)
          }}
	        >
	          <div className="relative pr-16">
	            <div className="min-w-0 truncate text-xs font-semibold leading-4 text-slate-900 dark:text-slate-100">{r.title}</div>
	            <div className="mt-0.5 truncate text-[11px] leading-4 text-slate-700 dark:text-slate-200">{displayTimeLabel}</div>
	            {r.requester_department ? (
	              <div className="mt-0.5 truncate text-[10px] leading-3 text-slate-700 dark:text-slate-200">{r.requester_department}</div>
	            ) : null}
	            <div className="absolute right-1 top-1">{statusPill(status)}</div>
	          </div>
	        </div>
	      )
	    }

    if (
      localDraggingReservation &&
      draggingState &&
      manilaDateKey(weekDays[draggingState.previewDayIndex ?? 0]) === manilaDateKey(day) &&
      manilaDateKey(localDraggingReservation.start_at) !== manilaDateKey(day)
    ) {
      const r = localDraggingReservation
      const start = new Date(r.start_at)
      const end = new Date(r.end_at)
      const startMin = minutesSinceMidnight(start)
      const endMin = minutesSinceMidnight(end)
      const rangeStartMin = START_HOUR * 60
      const rangeEndMin = END_HOUR * 60
      const topMin = clamp(startMin, rangeStartMin, rangeEndMin) - rangeStartMin
      const bottomMin = clamp(endMin, rangeStartMin, rangeEndMin) - rangeStartMin
      const heightMin = Math.max(20, bottomMin - topMin)
      const top = (topMin / 60) * hourHeight
      const height = (heightMin / 60) * hourHeight
      const status = r.status
      const color =
        status === "approved"
          ? "bg-emerald-500/15 ring-1 ring-emerald-500/30"
          : status === "pending"
          ? "bg-brand-secondary/25 ring-1 ring-brand-secondary/60"
          : status === "rejected"
          ? "bg-rose-500/15 ring-1 ring-rose-500/30"
          : "bg-slate-500/10 ring-1 ring-slate-300"

      const dragTop = clamp(draggingState.previewTop, 0, hourRows.length * hourHeight - height)

      const durationMinutes = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000))
      const rawMinutes = (dragTop / hourHeight) * 60
      const snapped = roundToStep(rawMinutes, 30)
      const startOffset = clamp(snapped, 0, totalMinutes - durationMinutes)
      const previewStart = new Date(setManilaTimeOnDay(day, START_HOUR, 0).getTime() + startOffset * 60000)
      const previewEnd = new Date(previewStart.getTime() + durationMinutes * 60 * 1000)
      const previewTimeLabel = formatTimeRange12(previewStart, previewEnd)

      const { col = 0, cols = 1 } = layout.get(r.id) || {}
      const left = `calc(${(col / cols) * 100}% + 4px)`
      const right = `calc(${((cols - col - 1) / cols) * 100}% + 4px)`

      rendered.push(
        <div
          key={`drag-preview-${r.id}`}
          className={`pointer-events-auto absolute overflow-hidden rounded-lg px-2 py-1 ${color}`}
          style={{ top: dragTop, height, left, right, opacity: 0.85 }}
          title={`${r.title} (${status})`}
	        >
	          <div className="relative pr-16">
	            <div className="truncate text-xs font-semibold leading-4 text-slate-900 dark:text-slate-100">{r.title}</div>
	            <div className="mt-0.5 truncate text-[11px] leading-4 text-slate-700 dark:text-slate-200">{previewTimeLabel}</div>
	            {r.requester_department ? (
	              <div className="mt-0.5 truncate text-[10px] leading-3 text-slate-700 dark:text-slate-200">{r.requester_department}</div>
	            ) : null}
	            <div className="absolute right-1 top-1">{statusPill(status)}</div>
	          </div>
	        </div>
	      )
	    }

    if (draggingSeriesId && draggingState?.started && Array.isArray(list) && seriesPreviewStart) {
      for (const r of list) {
        if (!r || r.id === draggingState.reservationId) continue
        if (String(r.repeat_series_id || "") !== draggingSeriesId) continue
        if (previewRenderedIds.has(r.id)) continue

        const originalStart = new Date(r.start_at)
        const nextStart = new Date(originalStart.getTime() + seriesDeltaMs)
        if (manilaDateKey(nextStart) !== manilaDateKey(day)) continue
        const nextEnd = new Date(nextStart.getTime() + draggingState.durationMinutes * 60 * 1000)

        const startMin = minutesSinceMidnight(nextStart)
        const endMin = minutesSinceMidnight(nextEnd)
        const topMin = clamp(startMin, rangeStartMin, rangeEndMin) - rangeStartMin
        const bottomMin = clamp(endMin, rangeStartMin, rangeEndMin) - rangeStartMin
        const heightMin = Math.max(20, bottomMin - topMin)

        const top = (topMin / 60) * hourHeight
        const height = (heightMin / 60) * hourHeight

        const status = r.status
        const color =
          status === "approved"
            ? "bg-emerald-500/15 ring-1 ring-emerald-500/30"
            : status === "pending"
            ? "bg-brand-secondary/25 ring-1 ring-brand-secondary/60"
            : status === "rejected"
            ? "bg-rose-500/15 ring-1 ring-rose-500/30"
            : "bg-slate-500/10 ring-1 ring-slate-300"

        const timeLabel = formatTimeRange12(nextStart, nextEnd)

        rendered.push(
          <div
            key={`series-preview-extra-${r.id}`}
            className={`pointer-events-none absolute overflow-hidden rounded-lg px-2 py-1 ${color} transition-[top,left] duration-150 ease-out`}
            style={{ top, height, left: "4px", right: "4px", opacity: 0.6 }}
            title={`${r.title} (${status})`}
          >
            <div className="relative pr-16">
              <div className="min-w-0 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{r.title}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-700 dark:text-slate-200">{timeLabel}</div>
              <div className="absolute right-1 top-1">{statusPill(status)}</div>
            </div>
          </div>
        )
      }
    }

    return rendered
  }

  function renderWeekCalendar(weekStartDate, list, active) {
    const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStartDate, i))
    const reservationsByDay = buildReservationsByDay(weekDays, list)
    const draggingState = active ? dragging : null
    const todayStart = startOfDayLocal(new Date())
    const nowMinutes = minutesSinceMidnight(Date.now())

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={active ? calendarHeaderRef : null}
          className="grid grid-cols-[88px_repeat(5,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">Time</div>
          {weekDays.map((d) => (
            <div key={d.toISOString()} className={`px-3 py-2 ${startOfDayLocal(d) < todayStart ? "opacity-60" : ""}`}>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">{manilaWeekdayShort(d)}</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {manilaMonthShortDay(d)}
              </div>
            </div>
          ))}
        </div>

        <div
          ref={active ? calendarRef : null}
          className="relative grid min-h-0 flex-1 grid-cols-[88px_repeat(5,minmax(0,1fr))]"
        >
          <div className="border-r border-slate-200 dark:border-slate-800">
            {hourRows.map((h) => (
              <div
                key={h}
                className="relative flex items-start justify-end pr-3 text-xs text-slate-500 dark:text-slate-400"
                style={{ height: hourHeight }}
              >
                <div className="pt-1">{h <= 12 ? `${h} ${h === 12 ? "PM" : "AM"}` : `${h - 12} PM`}</div>
              </div>
            ))}
          </div>

          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className="relative border-r border-slate-200 bg-white last:border-r-0 dark:border-slate-800 dark:bg-slate-950"
            >
              <div
                className="relative"
                style={{ height: hourRows.length * hourHeight }}
                onClick={(e) => {
                  if (!allowInteraction || !active) return
                  if (startOfDayLocal(day) < todayStart) return
                  if (draggingState?.started) return
                  if (Date.now() < suppressOpenUntilRef.current) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top
                  const hourFloat = START_HOUR + y / hourHeight
                  const hour = clamp(Math.floor(hourFloat), START_HOUR, END_HOUR - 1)
                  openNewReservation(day, hour)
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open reservation modal for ${manilaDateKey(day)}`}
              >
                {(() => {
                  const dayStart = startOfDayLocal(day)
                  const fullHeight = hourRows.length * hourHeight

                  if (dayStart < todayStart) {
                    return (
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 z-0 bg-slate-100/70 dark:bg-slate-900/60"
                        style={{ height: fullHeight }}
                      />
                    )
                  }

                  if (dayStart.getTime() === todayStart.getTime()) {
                    const startMinutes = START_HOUR * 60
                    const endMinutes = END_HOUR * 60
                    const clamped = clamp(nowMinutes, startMinutes, endMinutes)
                    const pastMinutes = Math.max(0, clamped - startMinutes)
                    const height = (pastMinutes / 60) * hourHeight
                    if (height <= 0) return null

                    return (
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 bg-slate-100/70 dark:bg-slate-900/60" style={{ height }} />
                    )
                  }

                  return null
                })()}
                {hourRows.map((h) => (
                  <div key={h} className="border-b border-slate-100 dark:border-slate-800/60" style={{ height: hourHeight }} />
                ))}
                {renderEventsForDayGeneric(day, weekDays, reservationsByDay, list, draggingState)}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-[220px]">
            <BrandMark brand={brand} />
          </div>

          <div className="flex flex-1 items-center justify-center gap-2">
            <Button variant="neutral" onClick={() => setWeekStart(startOfWorkWeek(new Date()))}>
              Today
            </Button>
            <Button variant="neutral" onClick={goPrevWeek} disabled={!allowInteraction}>
              ‹
            </Button>
            <div className="px-2 text-sm font-medium text-slate-900 dark:text-slate-100">{formatRangeTitle(weekStart)}</div>
            <Button variant="neutral" onClick={goNextWeek} disabled={!allowInteraction}>
              ›
            </Button>
          </div>

	          <div className="flex items-center gap-2">
	            <div className="w-56">
	              <DropdownSelect
	                options={meetingRoomOptions}
	                value={meetingRoomId || ""}
	                onChange={(v) => setMeetingRoomId(String(v || ""))}
	                disabled={roomsLoading || !meetingRoomOptions.length}
	                placeholder={roomsLoading ? "Loading rooms…" : meetingRoomOptions.length ? "Select room…" : "No rooms found"}
	                align="end"
	              />
	            </div>
	            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark", themeScope)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
	            {!user ? (
	              <a
	                href={withBasePath("/login")}
	                className="inline-flex items-center justify-center rounded-lg border border-brand-primary/30 bg-white px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 dark:border-brand-secondary/40 dark:bg-slate-900 dark:text-brand-secondary dark:hover:bg-slate-800"
	              >
	                Login
	              </a>
	            ) : null}
	            {user && perms.anyAccess ? (
	              <a
	                href={withBasePath("/admin")}
	                className="inline-flex items-center justify-center rounded-lg border border-brand-primary/30 bg-white px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 dark:border-brand-secondary/40 dark:bg-slate-900 dark:text-brand-secondary dark:hover:bg-slate-800"
	              >
	                Admin Panel
	              </a>
	            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden px-4 py-3">
        <div
          ref={calendarPanelRef}
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800 dark:shadow-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            if (!allowInteraction) return
            if (modalOpen) return
            if (dragging) return
            if (e.pointerType !== "touch" && e.pointerType !== "pen") return
            if (e.target?.closest?.('[data-reservation-card="true"]')) return
            touchRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: false }
          }}
          onPointerMove={(e) => {
            const start = touchRef.current
            if (!start) return
            if (start.pointerId !== e.pointerId) return
            const dx = e.clientX - start.x
            const dy = e.clientY - start.y
            if (!start.active) {
              if (Math.abs(dx) < 20) return
              if (Math.abs(dx) < Math.abs(dy) * 1.5) return
              start.active = true
              touchRef.current = start
            }
            if (start.active) {
              e.preventDefault()
            }
          }}
          onPointerUp={(e) => {
            const start = touchRef.current
            touchRef.current = null
            if (!start) return
            if (start.pointerId !== e.pointerId) return
            if (!start.active) return
            const dx = e.clientX - start.x
            const dy = e.clientY - start.y
            if (Math.abs(dx) < 60) return
            if (Math.abs(dx) < Math.abs(dy) * 1.5) return
            if (dx < 0) goNextWeek()
            else goPrevWeek()
          }}
          onPointerCancel={() => {
            touchRef.current = null
          }}
        >
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <div
              className={`absolute inset-0 ${slideStage === "animate" ? "transition-transform duration-300 ease-in-out" : ""}`}
              style={{
                transform:
	                  slideStage === "animate"
	                    ? slideDir === "next"
	                      ? "translateX(-100%)"
	                      : slideDir === "prev"
	                      ? "translateX(100%)"
	                      : "translateX(0)"
	                    : "translateX(0)",
	              }}
            >
              {renderWeekCalendar(weekStart, reservations, true)}
            </div>

            {incomingWeekStart ? (
              <div
	                className={`absolute inset-0 ${slideStage === "animate" ? "transition-transform duration-300 ease-in-out" : ""}`}
                style={{
                  transform:
	                    slideStage === "prepare"
	                      ? slideDir === "next"
	                        ? "translateX(100%)"
	                        : "translateX(-100%)"
	                      : slideStage === "animate"
	                      ? "translateX(0)"
	                      : "translateX(0)",
	                }}
                onTransitionEnd={onSlideEnd}
              >
                {renderWeekCalendar(incomingWeekStart, incomingReservations || [], false)}
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <Modal
        open={modalOpen}
        title={modalMode === "create" ? "Reserve boardroom" : "Reservation details"}
        onClose={() => {
          setModalOpen(false)
          setDecisionOpen(false)
        }}
      >
        {modalSubmitting || modalApproving ? (
          <ModalSubmitting />
        ) : (
          (() => {
            const detailsReadOnly = modalMode === "view" && (selectedReservation?.status !== "pending" || !canEditReservations)
            return (
	        <form className="space-y-3" onSubmit={modalMode === "create" ? submitReservation : saveEdits}>
	          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-200">Title</label>
              <Input value={modalTitle} onChange={(e) => setModalTitle(e.target.value)} placeholder="Meeting title" required disabled={detailsReadOnly} />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-200">Email</label>
              <Input
                type="email"
                value={modalEmail}
                onChange={(e) => setModalEmail(e.target.value)}
                placeholder="name@company.com"
                required
                disabled={detailsReadOnly}
              />
            </div>

		            <div className="md:col-span-2">
		              <label className="text-xs font-medium text-slate-700 dark:text-slate-200">Department</label>
		              <DropdownSelect
		                options={departmentOptions}
		                value={modalDepartment}
		                onChange={(v) => setModalDepartment(String(v || ""))}
		                disabled={detailsReadOnly}
		                placeholder="Select department…"
		                align="end"
		              />
		            </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-200">Number of attendees (max 18)</label>
                <Input
                  type="number"
                  min={1}
                  max={18}
                  step={1}
                  value={modalAttendees}
                  onChange={(e) => setModalAttendees(e.target.value)}
                  placeholder="1–18"
                  required
                  disabled={detailsReadOnly}
                />
              </div>

              {modalMode === "create" || (modalMode === "view" && selectedReservation?.status === "pending") ? (
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 text-sm font-medium text-slate-700 dark:text-slate-200">Repeat</div>
                    <button
                      type="button"
                      onClick={openRepeatModal}
                      disabled={detailsReadOnly}
                      className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
                    >
                      {formatRepeatSummary()}
                    </button>
                  </div>
                </div>
              ) : null}

	            <div>
	              <label className="text-xs font-medium text-slate-700 dark:text-slate-200">Start</label>
	              <Input
	                type="datetime-local"
                value={modalStart}
                onChange={(e) => setModalStart(e.target.value)}
                required
                disabled={detailsReadOnly}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-200">End</label>
              <Input
                type="datetime-local"
                value={modalEnd}
                onChange={(e) => setModalEnd(e.target.value)}
                required
                disabled={detailsReadOnly}
              />
            </div>
          </div>

	          <div className="flex justify-end gap-2">
              <div className="flex w-full items-center justify-between gap-2">
                <div>
                  {modalMode === "view" && selectedReservation?.status === "pending" && isApprover ? (
                    <div className="flex gap-2">
                      <Button variant="success" type="button" onClick={() => openDecision("accept")} disabled={modalSubmitting || modalApproving}>
                        Accept
                      </Button>
                      <Button variant="danger" type="button" onClick={() => openDecision("reject")} disabled={modalSubmitting || modalApproving}>
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <Button variant="neutral" type="button" onClick={() => setModalOpen(false)} disabled={modalSubmitting || modalApproving}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={detailsReadOnly || modalApproving}
                  >
                    {modalMode === "create" ? "Submit for approval" : "Save changes"}
                  </Button>
                </div>
              </div>
	          </div>
	        </form>
            )
          })()
        )}
      </Modal>

      <Modal
        open={decisionOpen}
        title={decisionAction === "accept" ? "Accept reservation" : "Reject reservation"}
        onClose={() => setDecisionOpen(false)}
      >
        {selectedReservation ? (
          modalApproving ? (
            <ModalSubmitting />
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-200 dark:ring-slate-700">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{selectedReservation.title}</div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {formatDateTime(selectedReservation.start_at)} – {formatDateTime(selectedReservation.end_at)}
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  Requested by:{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {selectedReservation.requester_email || selectedReservation.requester?.email || "-"}
                  </span>
                </div>
              </div>

              {decisionAction === "reject" ? (
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-200">Reason (optional)</label>
                  <textarea
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-primary/50 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-secondary/60"
                    placeholder="Add a reason for rejection..."
                  />
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button variant="neutral" onClick={() => setDecisionOpen(false)}>
                  Cancel
                </Button>
                <Button variant={decisionAction === "reject" ? "danger" : "primary"} onClick={confirmDecision}>
                  {decisionAction === "accept" ? "Accept" : "Reject"}
                </Button>
              </div>
            </div>
          )
        ) : null}
      </Modal>

        <Modal
          open={repeatOpen}
          title="Repeat"
          onClose={() => {
            setRepeatOpen(false)
          }}
          panelClassName="max-w-md"
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-200">Start</label>
                <Input
                  type="date"
                  value={repeatDraftStartDate}
                  onChange={(e) => setRepeatDraftStartDate(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-200">Repeat every</label>
                <div className="mt-1 flex items-center gap-2">
	                  <Input
	                    type="number"
	                    min={1}
	                    step={1}
	                    value={repeatDraftEvery}
	                    onChange={(e) => setRepeatDraftEvery(e.target.value)}
	                    className="w-20"
	                  />
	                  <div className="min-w-[140px] flex-1">
	                    <DropdownSelect
	                      value={repeatDraftUnit}
	                      onChange={(v) => setRepeatDraftUnit(String(v || "week"))}
	                      options={[
	                        { value: "week", label: "week" },
	                        { value: "month", label: "month" },
	                      ]}
	                      align="end"
	                    />
	                  </div>
	                </div>
	              </div>

              <div className="md:col-span-2">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Days</div>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const selected = (repeatDraftDays || []).includes(n)
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setRepeatDraftDays((prev) => {
                            const set = new Set(prev || [])
                            if (set.has(n)) set.delete(n)
                            else set.add(n)
                            return Array.from(set)
                          })
                        }}
                        className={`h-10 w-10 rounded-full text-sm font-semibold ring-1 transition ${
                          selected
                            ? "bg-brand-primary text-white ring-brand-primary dark:bg-brand-secondary dark:text-slate-900 dark:ring-brand-secondary"
                            : "bg-white text-slate-900 ring-slate-300 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-900/60"
                        }`}
                        aria-pressed={selected}
                      >
                        {weekdayLabel(n)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="neutral"
                type="button"
                onClick={() => {
                  setRepeatOpen(false)
                }}
              >
                Discard
              </Button>
              <Button type="button" onClick={saveRepeatModal}>
                Save
              </Button>
            </div>
          </div>
        </Modal>
	    </div>
	  )
	}
