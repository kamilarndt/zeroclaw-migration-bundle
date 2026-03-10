import { useState, useRef, FormEvent } from 'react'
import { useAudioRecorder } from '@hooks/useAudioRecorder'
import { Paperclip, Mic, Send, StopCircle } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string, attachments?: File[], audioData?: ArrayBuffer) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    isRecording,
    startRecording,
    stopRecording,
    audioBlob,
    resetRecording
  } = useAudioRecorder()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!input.trim() && attachments.length === 0 && !audioBlob) return

    let audioData: ArrayBuffer | undefined
    if (audioBlob) {
      audioData = await audioBlob.arrayBuffer()
      resetRecording()
    }

    onSend(input, attachments, audioData)

    setInput('')
    setAttachments([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments(prev => [...prev, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="p-4 bg-neutral-900 border-t border-neutral-800">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-2 py-1 bg-neutral-900 rounded text-sm"
            >
              <Paperclip className="w-4 h-4 text-neutral-500" />
              <span className="text-neutral-300 truncate max-w-[200px]">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="text-neutral-500 hover:text-red-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Attachment Button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
          disabled={disabled}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Audio Input Button */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`
            p-2 rounded-lg transition-colors
            ${isRecording
              ? 'text-red-400 bg-red-500/20 animate-pulse'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }
          `}
          disabled={disabled}
        >
          <Mic className="w-5 h-5" />
        </button>

        {/* Text Input */}
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg resize-none focus:outline-none focus:border-indigo-500 disabled:opacity-50 placeholder:text-neutral-600"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={disabled || (!input.trim() && attachments.length === 0 && !audioBlob)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-lg transition-colors"
        >
          {isRecording ? (
            <StopCircle className="w-5 h-5" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  )
}
