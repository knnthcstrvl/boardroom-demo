import React from "react"

function Cell() {
  return <div className="br-shimmer h-4 w-full" />
}

export default function TableSkeleton({ columns = 5, rows = 6 }) {
  const colCount = Math.max(1, Number(columns) || 1)
  const rowCount = Math.max(1, Number(rows) || 1)

  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: colCount }).map((__, colIndex) => (
            <td key={colIndex} className="px-3 py-3">
              <Cell />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

