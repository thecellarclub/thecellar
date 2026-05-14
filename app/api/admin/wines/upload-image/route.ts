import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'
import { randomUUID } from 'crypto'

const BUCKET = 'wine-images'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File must be JPEG, PNG or WebP' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
  }

  const ext = EXTENSIONS[file.type]
  const filename = `${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const sb = createServiceClient()

  // Ensure bucket exists (create if missing, ignore "already exists" error)
  const { error: bucketError } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: ALLOWED_TYPES,
  })
  if (bucketError && !bucketError.message.includes('already exists')) {
    console.error('[upload-image] bucket create error', bucketError)
    return NextResponse.json({ error: 'Storage not available' }, { status: 500 })
  }

  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[upload-image] upload error', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(filename)

  return NextResponse.json({ url: publicUrl })
}
