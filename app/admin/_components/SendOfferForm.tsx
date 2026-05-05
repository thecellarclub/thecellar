'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface Wine {
  id: string
  name: string
  price_pence: number
  stock_bottles: number
}

interface Props {
  customerId: string
  customerName: string
  hasCard: boolean
  wines: Wine[]
}

function buildPreview(qty: number, wineName: string, totalStr: string, hasCard: boolean): string {
  if (hasCard) {
    return `Daniel here - I've set aside ${qty} x ${wineName} for you (${totalStr}). Reply YES to confirm.`
  }
  return `Daniel here - I've set aside ${qty} x ${wineName} for you (${totalStr}). Add your card at thecellar.club/billing?token=... then reply YES to confirm.`
}

function smsSegments(text: string): { chars: number; segments: number } {
  // Rough GSM-7 count — extended chars ({}\\[~]|€^) cost 2 units each
  const extended = new Set(['{', '}', '\\', '[', '~', ']', '|', '€', '^'])
  let units = 0
  for (const ch of text) {
    units += extended.has(ch) ? 2 : 1
  }
  const segments = units <= 160 ? 1 : Math.ceil(units / 153)
  return { chars: units, segments }
}

export default function SendOfferForm({ customerId, customerName, hasCard, wines }: Props) {
  const router = useRouter()

  const availableWines = useMemo(() => wines.filter((w) => w.stock_bottles > 0), [wines])

  const [wineId, setWineId] = useState(availableWines[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedWine = availableWines.find((w) => w.id === wineId)
  const maxQty = selectedWine?.stock_bottles ?? 1
  const totalPence = (selectedWine?.price_pence ?? 0) * quantity
  const totalStr = `£${(totalPence / 100).toFixed(2)}`
  const preview = selectedWine
    ? buildPreview(quantity, selectedWine.name, totalStr, hasCard)
    : ''
  const { chars, segments } = smsSegments(preview)

  function handleWineChange(id: string) {
    setWineId(id)
    setQuantity(1)
    setError(null)
    setConfirming(false)
  }

  async function send() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/send-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineId, quantity }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send offer')
        setLoading(false)
        setConfirming(false)
        return
      }
      setSuccess(true)
      setConfirming(false)
      setWineId(availableWines[0]?.id ?? '')
      setQuantity(1)
      router.refresh()
    } catch {
      setError('Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  if (availableWines.length === 0) {
    return <p className="text-sm text-gray-500">No wines in stock to offer.</p>
  }

  const inputCls = 'text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white disabled:opacity-50'

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Wine</label>
          <select
            value={wineId}
            onChange={(e) => handleWineChange(e.target.value)}
            disabled={loading}
            className={inputCls}
          >
            {availableWines.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} — £{(w.price_pence / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            max={maxQty}
            value={quantity}
            onChange={(e) => {
              setQuantity(Math.min(maxQty, Math.max(1, Number(e.target.value))))
              setError(null)
              setConfirming(false)
            }}
            disabled={loading}
            className={`w-20 ${inputCls}`}
          />
        </div>
      </div>

      {/* SMS preview */}
      {preview && (
        <div>
          <p className="text-xs text-gray-500 mb-1">SMS preview</p>
          <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">
            {preview}
          </div>
          <p className="text-xs text-gray-400 mt-1">{chars} chars · {segments} segment{segments !== 1 ? 's' : ''}</p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {success && (
        <p className="text-xs text-green-700 font-medium">Offer sent — waiting for {customerName} to reply YES.</p>
      )}

      {!confirming ? (
        <button
          type="button"
          onClick={() => { setSuccess(false); setConfirming(true) }}
          disabled={loading || !wineId}
          className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 font-medium disabled:opacity-50"
        >
          Send offer
        </button>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-gray-700">
            Send <strong>{quantity} × {selectedWine?.name}</strong> ({totalStr}) to {customerName}?
          </p>
          <button
            type="button"
            onClick={send}
            disabled={loading}
            className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 font-medium disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
