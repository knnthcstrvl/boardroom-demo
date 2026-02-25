const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function pad2(n) {
  return String(n).padStart(2, "0")
}

export function utcMs(value) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number") return value
  return new Date(value).getTime()
}

export function manilaParts(value) {
  const ms = utcMs(value)
  const d = new Date(ms + MANILA_OFFSET_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(), // 0=Sun..6=Sat
  }
}

export function manilaDateKey(value) {
  const p = manilaParts(value)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}

export function manilaWeekdayShort(value) {
  const p = manilaParts(value)
  return WEEKDAY_SHORT[p.weekday] || ""
}

export function manilaMonthShortDay(value) {
  const p = manilaParts(value)
  const m = MONTH_SHORT[p.month - 1] || ""
  return `${m} ${p.day}`
}

export function manilaInputValue(value) {
  const p = manilaParts(value)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`
}

export function utcMsFromManilaInput(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ""))
  if (!m) return Number.NaN
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return Number.NaN
  }

  return Date.UTC(year, month - 1, day, hour, minute, 0, 0) - MANILA_OFFSET_MS
}

export function utcISOStringFromManilaInput(value) {
  const ms = utcMsFromManilaInput(value)
  if (!Number.isFinite(ms)) return ""
  return new Date(ms).toISOString()
}

export function manilaSqlFromInput(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ""))
  if (!m) return ""
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:00`
}

export function manilaSqlDateTime(value) {
  const p = manilaParts(value)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`
}

export function startOfManilaDay(value) {
  const p = manilaParts(value)
  const ms = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0) - MANILA_OFFSET_MS
  return new Date(ms)
}

export function startOfManilaWorkWeek(value) {
  const dayStart = startOfManilaDay(value)
  const p = manilaParts(dayStart)
  const diffToMon = (p.weekday + 6) % 7
  return new Date(utcMs(dayStart) - diffToMon * 86400000)
}

export function addDaysUtc(value, days) {
  return new Date(utcMs(value) + days * 86400000)
}

export function setManilaTimeOnDay(dayValue, hour, minute = 0) {
  const p = manilaParts(dayValue)
  const ms = Date.UTC(p.year, p.month - 1, p.day, hour, minute, 0, 0) - MANILA_OFFSET_MS
  return new Date(ms)
}

export function manilaMinutesSinceMidnight(value) {
  const p = manilaParts(value)
  return p.hour * 60 + p.minute
}

export function formatManilaTime12(value) {
  const p = manilaParts(value)
  const h24 = p.hour
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const suffix = h24 >= 12 ? "PM" : "AM"
  return `${h12}:${pad2(p.minute)} ${suffix}`
}

export function formatManilaTimeRange12(start, end) {
  return `${formatManilaTime12(start)}–${formatManilaTime12(end)}`
}

export function formatManilaDateTime(value) {
  const p = manilaParts(value)
  const h24 = p.hour
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const suffix = h24 >= 12 ? "PM" : "AM"
  return `${pad2(p.month)}/${pad2(p.day)}/${p.year} ${h12}:${pad2(p.minute)} ${suffix}`
}

export function formatManilaWorkWeekRangeTitle(weekStartValue) {
  const weekStart = new Date(utcMs(weekStartValue))
  const weekEnd = addDaysUtc(weekStart, 4)
  const a = manilaParts(weekStart)
  const b = manilaParts(weekEnd)
  const sameMonth = a.month === b.month
  const sameYear = a.year === b.year

  if (sameMonth && sameYear) {
    return `${MONTH_LONG[a.month - 1]} ${a.day}–${b.day}, ${a.year}`
  }

  const left = `${MONTH_LONG[a.month - 1]} ${a.day}, ${a.year}`
  const right = `${MONTH_LONG[b.month - 1]} ${b.day}, ${b.year}`
  return `${left} – ${right}`
}
