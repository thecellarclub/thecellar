'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SmsCharCounter from './SmsCharCounter'

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
    image_url?: string
    retail_price_pounds?: string
    website_description?: string
    slug?: string
  }
  onClose?: () => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
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
    image_url: initial.image_url ?? '',
    retail_price_pounds: initial.retail_price_pounds ?? '',
    website_description: initial.website_description ?? '',
    slug: initial.slug ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function autoSlug() {
    if (form.slug) return
    const base = slugify(form.name)
    const suffix = form.vintage ? `-${form.vintage}` : ''
    if (base) setForm((f) => ({ ...f, slug: base + suffix }))
  }

  async function handleImageFile(file: File) {
    setImageError(null)
    setImageUploading(true)
    const data = new FormData()
    data.append('image', file)
    try {
      const res = await fetch('/api/admin/wines/upload-image', { method: 'POST', body: data })
      const json = await res.json()
      if (!res.ok) {
        setImageError(json.error ?? 'Upload failed')
      } else {
        setForm((f) => ({ ...f, image_url: json.url }))
      }
    } catch {
      setImageError('Upload failed')
    } finally {
      setImageUploading(false)
    }
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
    'w-full border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Name *</label>
          <input required value={form.name} onChange={set('name')} onBlur={autoSlug} className={inputCls} />
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
          <input type="number" value={form.vintage} onChange={set('vintage')} onBlur={autoSlug} className={inputCls} placeholder="e.g. 2022" />
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
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Description (used in SMS)</label>
          <SmsCharCounter value={form.description} />
        </div>
        <textarea
          value={form.description}
          onChange={set('description')}
          rows={3}
          className={inputCls}
        />
        <p className="text-xs text-gray-500 mt-1">This is appended to the offer template — total SMS length may vary.</p>
      </div>

      {/* ── Wine page section ─────────────────────────────────────────── */}
      <div className="pt-3 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Wine page</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Page URL slug</label>
            <input
              value={form.slug}
              onChange={set('slug')}
              className={inputCls}
              placeholder="e.g. chablis-premier-cru-2022"
            />
            {form.slug && (
              <p className="text-xs text-gray-600 mt-1">thecellar.club/wine/{form.slug}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Image</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageFile(file)
                e.target.value = ''
              }}
            />
            {form.image_url ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image_url}
                  alt="Wine"
                  className="max-h-[200px] rounded border border-gray-200 object-contain"
                />
                <div className="flex gap-3 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-600 underline hover:text-gray-900"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                    className="text-xs text-red-500 underline hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors disabled:opacity-50"
              >
                {imageUploading ? (
                  <span className="text-sm text-gray-500">Uploading…</span>
                ) : (
                  <span className="text-sm text-gray-500">Drop an image or click to browse</span>
                )}
              </button>
            )}
            {imageError && <p className="text-xs text-red-600 mt-1">{imageError}</p>}
          </div>
          <div>
            <label className={labelCls}>Retail price (£)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.retail_price_pounds}
              onChange={set('retail_price_pounds')}
              className={inputCls}
              placeholder="e.g. 18.99"
            />
          </div>
          <div>
            <label className={labelCls}>Website description (shown on wine page)</label>
            <textarea
              value={form.website_description}
              onChange={set('website_description')}
              rows={5}
              className={inputCls}
              placeholder="Tasting notes, food pairings, producer story..."
            />
          </div>
        </div>
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
