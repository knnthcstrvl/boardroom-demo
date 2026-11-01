import React from "react"
import { withBasePath } from "../lib/url"

function renderBoardRoom(name) {
  const normalized = String(name || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase()

  if (normalized !== "boardroom") return null

  return (
    <>
      <span className="text-brand-primary">Board</span>
      <span className="text-brand-secondary">Room</span>
    </>
  )
}

export default function BrandMark({ brand, size = 40, textScale = 0.72, showText = true, className = "" }) {
  const name = brand?.name || "BoardRoom"
  const boardRoom = renderBoardRoom(name)
  const fontSize = Math.max(12, Math.round(size * textScale))

  const Tag = "a"
  const tagProps = {
    href: withBasePath("/kiosk"),
    "aria-label": "Go to kiosk",
  }

  return (
    <Tag className={`flex items-center gap-3 no-underline hover:opacity-95 ${className}`} {...tagProps}>
      {showText ? (
        <div className="flex items-center" style={{ height: size }}>
          <div className="font-semibold leading-none tracking-tight" style={{ fontSize, lineHeight: 1 }}>
            {boardRoom || <span className="text-slate-900 dark:text-slate-100">{name}</span>}
          </div>
        </div>
      ) : (
        <div className="flex items-center font-semibold leading-none tracking-tight" style={{ height: size, fontSize }} aria-hidden="true">
          <span className="text-brand-primary">B</span><span className="text-brand-secondary">R</span>
        </div>
      )}
    </Tag>
  )
}
