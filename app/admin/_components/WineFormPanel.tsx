'use client'

import { useState } from 'react'
import WineForm from './WineForm'

export default function WineFormPanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
      >
        <span>+ Add new wine</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          <WineForm mode="add" onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
