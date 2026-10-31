'use client'

import { useState } from 'react'
import { FileUploaderRegular } from '@uploadcare/react-uploader/next'
import '@uploadcare/react-uploader/core.css'

type UploadedFile = { uuid: string; name: string }

export default function ImageUploader({ initialIds = [] }: { initialIds?: string[] }) {
  const [files, setFiles] = useState<UploadedFile[]>(() => initialIds.map((uuid) => ({ uuid, name: 'Ảnh đính kèm' })))

  function handleUpload(event: unknown) {
    const file = (event as { file?: { uuid?: string; name?: string } }).file
    if (!file?.uuid || !/^[0-9a-f-]{36}$/i.test(file.uuid)) return
    setFiles((current) => current.some((entry) => entry.uuid === file.uuid)
      ? current
      : [...current, { uuid: file.uuid!, name: file.name ?? 'Ảnh đã tải lên' }])
  }

  return (
    <div className="space-y-3">
      <FileUploaderRegular
        pubkey={process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY ?? ''}
        accept="image/*"
        multiple
        maxLocalFileSizeBytes={10 * 1024 * 1024}
        onFileUploadSuccess={handleUpload}
      />
      <input type="hidden" name="images" value={JSON.stringify(files.map(({ uuid }) => uuid))} />
      {files.length > 0 && <ul className="space-y-1 text-sm" aria-label="Ảnh đã tải lên">
        {files.map((file) => <li key={file.uuid} className="flex items-center justify-between gap-3">
          <span className="truncate">{file.name}</span>
          <button type="button" className="shrink-0 underline" onClick={() => setFiles((current) => current.filter((entry) => entry.uuid !== file.uuid))}>Xóa ảnh</button>
        </li>)}
      </ul>}
    </div>
  )
}
