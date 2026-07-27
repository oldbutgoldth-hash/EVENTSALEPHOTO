export type ImageKitUploadResult = {
  fileId: string
  name: string
  filePath: string
  url: string
  thumbnailUrl?: string
  height?: number
  width?: number
  size?: number
}

export type EventPhotoUploadResult = {
  original: ImageKitUploadResult
  preview: ImageKitUploadResult
}

type UploadAuth = {
  token: string
  expire: number
  signature: string
  publicKey: string
}

async function getUploadAuth(): Promise<UploadAuth> {
  const authResponse = await fetch('/api/imagekit-auth', { credentials: 'include', cache: 'no-store' })
  if (!authResponse.ok) throw new Error('ขอสิทธิ์อัปโหลด ImageKit ไม่สำเร็จ')
  return authResponse.json() as Promise<UploadAuth>
}

function uploadToImageKit(input: {
  file: Blob
  fileName: string
  auth: UploadAuth
  folder: string
  isPrivate: boolean
  tags: string
  onProgress?: (percent: number) => void
}): Promise<ImageKitUploadResult> {
  const formData = new FormData()
  formData.append('file', input.file)
  formData.append('fileName', input.fileName)
  formData.append('publicKey', input.auth.publicKey)
  formData.append('token', input.auth.token)
  formData.append('expire', String(input.auth.expire))
  formData.append('signature', input.auth.signature)
  formData.append('folder', input.folder)
  formData.append('isPrivateFile', String(input.isPrivate))
  formData.append('useUniqueFileName', 'true')
  formData.append('tags', input.tags)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) input.onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onerror = () => reject(new Error('เชื่อมต่อ ImageKit ไม่สำเร็จ'))
    xhr.onload = () => {
      let payload: ImageKitUploadResult & { message?: string }
      try {
        payload = JSON.parse(xhr.responseText || '{}') as ImageKitUploadResult & { message?: string }
      } catch {
        reject(new Error('ImageKit ส่งข้อมูลตอบกลับไม่ถูกต้อง'))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(payload.message || 'อัปโหลดภาพไม่สำเร็จ'))
        return
      }
      resolve(payload)
    }
    xhr.send(formData)
  })
}


async function cleanupUploadedFile(fileId?: string): Promise<void> {
  if (!fileId) return
  await fetch('/api/admin-delete-imagekit-file', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ fileId }),
  }).catch(() => undefined)
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    // Revoked after the image has decoded; decoded pixels stay available for canvas draw.
    URL.revokeObjectURL(url)
  }
}

async function createWatermarkedPreview(file: File): Promise<Blob> {
  const image = await loadImage(file)
  const maxEdge = 1400
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('เบราว์เซอร์ไม่รองรับการสร้าง Preview')

  context.drawImage(image, 0, 0, width, height)
  const fontSize = Math.max(28, Math.round(Math.min(width, height) * 0.055))
  context.save()
  context.translate(width / 2, height / 2)
  context.rotate(-Math.PI / 8)
  context.font = `700 ${fontSize}px Arial, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineWidth = Math.max(2, fontSize * 0.08)
  context.strokeStyle = 'rgba(45,45,45,0.55)'
  context.fillStyle = 'rgba(255,255,255,0.68)'
  const label = 'KO’AKE PREVIEW'
  const rowGap = fontSize * 2.6
  const columnGap = context.measureText(label).width + fontSize * 2.2
  for (let y = -height; y <= height; y += rowGap) {
    for (let x = -width; x <= width; x += columnGap) {
      context.strokeText(label, x, y)
      context.fillText(label, x, y)
    }
  }
  context.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('สร้างไฟล์ Preview ไม่สำเร็จ')), 'image/jpeg', 0.72)
  })
}

export async function uploadEventPhotoPair(
  file: File,
  eventSlug: string,
  onProgress?: (percent: number) => void,
): Promise<EventPhotoUploadResult> {
  const tags = `koake-event-photo,${eventSlug}`

  // Create and upload the small watermarked preview first. If the original upload
  // later fails, the orphaned file is small instead of a 12 MB camera original.
  onProgress?.(2)
  const previewBlob = await createWatermarkedPreview(file)
  onProgress?.(8)
  const previewAuth = await getUploadAuth()
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_ก-๙]/g, '-')
  const preview = await uploadToImageKit({
    file: previewBlob,
    fileName: `${baseName}-preview.jpg`,
    auth: previewAuth,
    folder: `/koake-event-photo/${eventSlug}/preview`,
    isPrivate: false,
    tags: `${tags},preview,watermarked`,
    onProgress: (percent) => onProgress?.(8 + Math.round(percent * 0.22)),
  })

  try {
    const originalAuth = await getUploadAuth()
    const original = await uploadToImageKit({
      file,
      fileName: file.name,
      auth: originalAuth,
      folder: `/koake-event-photo/${eventSlug}/original`,
      isPrivate: true,
      tags: `${tags},original`,
      onProgress: (percent) => onProgress?.(30 + Math.round(percent * 0.7)),
    })

    onProgress?.(100)
    return { original, preview }
  } catch (error) {
    await cleanupUploadedFile(preview.fileId)
    throw error
  }
}

export async function saveUploadedPhoto(input: {
  eventId: string
  category: string
  photoCode: string
  upload: EventPhotoUploadResult
}): Promise<void> {
  const response = await fetch('/api/admin-save-photo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    await Promise.all([
      cleanupUploadedFile(input.upload.original.fileId),
      cleanupUploadedFile(input.upload.preview.fileId),
    ])
    throw new Error(payload.error || 'บันทึกข้อมูลภาพไม่สำเร็จ')
  }
}
