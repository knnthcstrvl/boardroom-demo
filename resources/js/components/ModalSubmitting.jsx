import React from "react"
import Spinner from "./Spinner"

export default function ModalSubmitting({ message = "Submitting, please wait..." }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-sm font-semibold text-slate-700 dark:text-slate-300">
      <Spinner size={16} label="Submitting" />
      <span>{message}</span>
    </div>
  )
}
