function pad2(n) {
  return String(n).padStart(2, "0")
}

function formatTime12(d) {
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ""
  const h24 = date.getHours()
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const suffix = h24 >= 12 ? "PM" : "AM"
  return `${h12}:${pad2(date.getMinutes())} ${suffix}`
}

function fmtDateTime(d) {
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ""
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  return { day, time: formatTime12(date) }
}

export function formatConflictMessage(payload) {
  const conflict = payload?.conflict
  const requested = payload?.requested
  const cStart = conflict?.start_at
  const cEnd = conflict?.end_at
  const rStart = requested?.start_at
  const rEnd = requested?.end_at

  const status = conflict?.status ? `${String(conflict.status).charAt(0).toUpperCase()}${String(conflict.status).slice(1)}` : "Existing"

  if (cStart && cEnd) {
    const a = fmtDateTime(cStart)
    const b = fmtDateTime(cEnd)
    if (a.day && a.time && b.time) {
      return `Conflicts with a ${status} reservation on ${a.day}, ${a.time}–${b.time}.`
    }
  }

  if (rStart && rEnd) {
    const a = fmtDateTime(rStart)
    const b = fmtDateTime(rEnd)
    if (a.day && a.time && b.time) {
      return `That slot (${a.day}, ${a.time}–${b.time}) is not available.`
    }
  }

  return payload?.message || "That time slot is not available."
}
