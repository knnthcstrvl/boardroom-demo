import React, { useEffect, useMemo, useState } from "react"
import { getStoredTheme, getEffectiveTheme, getThemeScope } from "../lib/theme"
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
  const scope = getThemeScope()
  const [effectiveTheme, setEffectiveTheme] = useState(() => getEffectiveTheme(getStoredTheme(scope)))
  const logoUrlDark = brand?.logoUrlDark || brand?.logoUrl || ""
  const logoUrlLight = brand?.logoUrlLight || brand?.logoUrl || ""
  const boardRoom = renderBoardRoom(name)
  const fontSize = Math.max(12, Math.round(size * textScale))

  useEffect(() => {
    function onChanged(e) {
      const eventScope = e?.detail?.scope
      if (eventScope && eventScope !== scope) return
      const next = e?.detail?.effective || getEffectiveTheme(getStoredTheme(scope))
      setEffectiveTheme(next)
    }
    window.addEventListener("br.theme.changed", onChanged)
    return () => window.removeEventListener("br.theme.changed", onChanged)
  }, [])

  const logoUrl = useMemo(() => {
    return effectiveTheme === "dark" ? logoUrlLight : logoUrlDark
  }, [effectiveTheme, logoUrlDark, logoUrlLight])

  const Tag = "a"
  const tagProps = {
    href: withBasePath("/kiosk"),
    "aria-label": "Go to kiosk",
  }

  return (
    <Tag className={`flex items-center gap-3 no-underline hover:opacity-95 ${className}`} {...tagProps}>
      {logoUrl ? <img src={logoUrl} alt={name} className="w-auto" style={{ height: size, display: "block" }} /> : null}
      {showText ? (
        <div className="flex items-center" style={{ height: size }}>
          <div className="font-semibold leading-none tracking-tight" style={{ fontSize, lineHeight: 1 }}>
            {boardRoom || <span className="text-slate-900 dark:text-slate-100">{name}</span>}
          </div>
        </div>
      ) : null}
    </Tag>
  )
}
