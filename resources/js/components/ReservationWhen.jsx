import React from "react"
import { formatManilaTime12, manilaParts } from "../lib/manilaTime"

function monthWithPeriod(m) {
  return m === 0
    ? "Jan."
    : m === 1
      ? "Feb."
      : m === 2
        ? "Mar."
        : m === 3
          ? "Apr."
          : m === 4
            ? "May."
            : m === 5
              ? "Jun."
              : m === 6
                ? "Jul."
                : m === 7
                  ? "Aug."
                  : m === 8
                    ? "Sep."
                    : m === 9
                      ? "Oct."
                      : m === 10
                        ? "Nov."
                        : "Dec."
}

function formatDateWithPeriod(d) {
  const p = manilaParts(d)
  return `${monthWithPeriod(p.month - 1)} ${p.day}, ${p.year}`
}

function formatDateYmdWithPeriod(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""))
  if (!m) return ""
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return ""
  return `${monthWithPeriod(month - 1)} ${day}, ${year}`
}

function weekdayName(n) {
  return n === 1
    ? "Mon"
    : n === 2
      ? "Tues"
      : n === 3
        ? "Wed"
        : n === 4
          ? "Thu"
          : n === 5
            ? "Fri"
            : n === 6
              ? "Sat"
              : n === 7
                ? "Sun"
                : ""
}

function WhenPill({ variant, size, children }) {
  const styles =
    variant === "secondary"
      ? "bg-brand-secondary/20 text-slate-900 ring-1 ring-brand-secondary/40 dark:bg-brand-secondary/30 dark:text-slate-100 dark:ring-brand-secondary/55"
      : "bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/20 dark:bg-brand-primary/25 dark:text-slate-100 dark:ring-brand-primary/45"

  const sizing = size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2 py-1 text-xs"

  return <span className={`inline-flex items-center rounded-full font-semibold ${sizing} ${styles}`}>{children}</span>
}

export default function ReservationWhen({
  reservation,
  variant = "primary",
  size = "sm",
  appearance = "pills", // pills | plain
  className = "",
}) {
  const r = reservation
  const startDate = r?.start_at ? new Date(r.start_at) : null
  const endDate = r?.end_at ? new Date(r.end_at) : null
  if (!startDate || !endDate) return <span className={className}>-</span>

  const isRecurring = Boolean(r?.repeat_enabled || r?.repeat_series_id)
  const repeatDays = Array.isArray(r?.repeat_days) ? r.repeat_days : []
  const repeatLabel =
    isRecurring && repeatDays.length ? repeatDays.map((n) => weekdayName(Number(n))).filter(Boolean).join(", ") : ""

  const startTime = formatManilaTime12(r.start_at)
  const endTime = formatManilaTime12(r.end_at)
  const toClass = size === "xs" ? "text-[11px]" : "text-xs"

  if (appearance === "plain") {
    return isRecurring ? (
      <div className={className}>
        <div>
          Start: {formatDateYmdWithPeriod(r.repeat_start_date) || formatDateWithPeriod(startDate)}
          {repeatLabel ? ` | ${repeatLabel}` : ""}
        </div>
        <div>
          {startTime} to {endTime}
        </div>
      </div>
    ) : (
      <div className={className}>
        {formatDateWithPeriod(startDate)} {startTime} to {formatDateWithPeriod(endDate)} {endTime}
      </div>
    )
  }

  return isRecurring ? (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <WhenPill variant={variant} size={size}>
        Start: {formatDateYmdWithPeriod(r.repeat_start_date) || formatDateWithPeriod(startDate)}
        {repeatLabel ? ` | ${repeatLabel}` : ""}
      </WhenPill>
      <WhenPill variant={variant} size={size}>
        {startTime}
      </WhenPill>
      <span className={`${toClass} font-medium text-slate-500 dark:text-slate-400`}>to</span>
      <WhenPill variant={variant} size={size}>
        {endTime}
      </WhenPill>
    </div>
  ) : (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <WhenPill variant={variant} size={size}>
        {formatDateWithPeriod(startDate)} {startTime}
      </WhenPill>
      <span className={`${toClass} font-medium text-slate-500 dark:text-slate-400`}>to</span>
      <WhenPill variant={variant} size={size}>
        {formatDateWithPeriod(endDate)} {endTime}
      </WhenPill>
    </div>
  )
}
