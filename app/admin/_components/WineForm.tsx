'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface WineFormProps {
  mode: 'add' | 'edit'
  wineId?: string
  initial?: {
    name?: string
    producer?: string
    region?: string
    country?: string
    vintage?: string
    description?: string
    price_pounds?: string
    stock_bottles?: string
  }
  onClose?: () => void
}

export default function WineForm({ mode, wineId, initial = {}, onClose }: WineFormProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: initial.name ?? '',
    producer: initial.producer ?? '',
    region: initial.region ?? '',
    country: initial.country ?? '',
    vintage: initial.vintage ?? '',
    description: initial.description ?? '',
    price_pounds: initial.price_pounds ?? '',
    stock_bottles: initial.stock_bottles ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const url = mode === 'add' ? '/api/admin/wines' : `/api/admin/wines/${wineId}`
    const method = mode === 'add' ? 'POST' : 'PATCH'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed')
      return
    }

    router.refresh()
    onClose?.()
    if (mode === 'edit') router.push('/admin/wines')
  }

  const inputCls =
    'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Name *</label>
          <input required value={form.name} onChange={set('name')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Producer</label>
          <input value={form.producer} onChange={set('producer')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Region</label>
          <input value={form.region} onChange={set('region')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Country</label>
          <input value={form.country} onChange={set('country')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Vintage</label>
          <input type="number" value={form.vintage} onChange={set('vintage')} className={inputCls} placeholder="e.g. 2022" />
        </div>
        <div>
          <label className={labelCls}>Price (£) *</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.price_pounds}
            onChange={set('price_pounds')}
            className={inputCls}
            placeholder="e.g. 15.00"
          />
        </div>
        <div>
          <label className={labelCls}>Stock (bottles) *</label>
          <input
            required
            type="number"
            min="0"
            value={form.stock_bottles}
            onChange={set('stock_bottles')}
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Description (used in SMS)</label>
        <textarea
          value={form.description}
          onChange={set('description')}
          rows={3}
          className={inputCls}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Saving…' : mode === 'add' ? 'Add wine' : 'Save changes'}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
