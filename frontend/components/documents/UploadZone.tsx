'use client'
import { useState, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export function UploadZone({ leadId, onSuccess }: { leadId: string; onSuccess: () => void }) {
  const [state, setState] = useState<UploadState>('idle')
  const [filename, setFilename] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [dragging, setDragging] = useState(false)

  const upload = async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      setErrorMsg('Please upload a PDF file.')
      setState('error')
      return
    }
    setFilename(file.name)
    setState('uploading')
    const form = new FormData()
    form.append('file', file)
    form.append('leadId', leadId)
    try {
      const res = await fetch('/api/documents', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Upload failed')
      }
      setState('success')
      setTimeout(onSuccess, 1200)
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Upload failed')
      setState('error')
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [leadId])

  return (
    <div
      onDrop={onDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        dragging ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {state === 'idle' && (
        <>
          <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">Drop insurance PDF here</p>
          <p className="text-xs text-gray-400 mb-4">or click to browse</p>
          <label className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 cursor-pointer transition-colors">
            Choose file
            <input type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
          </label>
        </>
      )}
      {state === 'uploading' && (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <div>
            <p className="text-sm font-medium text-gray-700">Processing {filename}</p>
            <p className="text-xs text-gray-400 mt-1">Extracting data with AI...</p>
          </div>
        </div>
      )}
      {state === 'success' && (
        <div className="flex flex-col items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <div>
            <p className="text-sm font-medium text-gray-700">Extracted successfully</p>
            <p className="text-xs text-gray-400 mt-1">{filename}</p>
          </div>
        </div>
      )}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">Upload failed</p>
            <p className="text-xs text-red-400 mt-1">{errorMsg}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setState('idle')}>Try again</Button>
        </div>
      )}
    </div>
  )
}
