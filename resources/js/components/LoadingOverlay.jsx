import React from "react"
import Spinner from "./Spinner"
import BrandMark from "./BrandMark"

function getBrand() {
  const brand = window.__BRANDING__ || { name: "BoardRoom", logoUrlDark: "", logoUrlLight: "" }
  return brand
}

export function LoadingCard({ message = "Loading, please wait..." }) {
  const brand = getBrand()

  return (
    <div className="w-full max-w-[560px] rounded-2xl bg-white p-10 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex flex-col items-center text-center">
        <BrandMark brand={brand} className="justify-center" />

        <div className="mt-5 flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Spinner size={16} label="Loading" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  )
}

export function FullPageLoader({ show, message }) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-slate-950" role="status" aria-live="polite">
      <div className="px-4">
        <LoadingCard message={message} />
      </div>
    </div>
  )
}

export default FullPageLoader
