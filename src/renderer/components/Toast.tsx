import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-invalid-this, @typescript-eslint/unbound-method, prefer-const, @typescript-eslint/no-misused-promises */


export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

const iconMap = {
  success: <CheckCircle size={15} />,
  error: <AlertCircle size={15} />,
  info: <Info size={15} />,
}

export function ToastContainer({ toasts, onDismiss }: ToastProps): JSX.Element {
  if (toasts.length === 0) return <></>
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-icon">{iconMap[toast.type]}</span>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => onDismiss(toast.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

// Global toast hook
let toastHandler: ((msg: Omit<ToastMessage, 'id'>) => void) | null = null

export function showToast(type: ToastType, message: string) {
  toastHandler?.({ type, message })
}

export function useToasts(): {
  toasts: ToastMessage[]
  dismiss: (id: string) => void
} {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Auto-dismiss after 3s
  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map(t =>
      setTimeout(() => dismiss(t.id), 3000)
    )
    return () => timers.forEach(clearTimeout)
  }, [toasts, dismiss])

  // Register global handler
  useEffect(() => {
    toastHandler = (msg) => {
      const id = `toast-${Date.now()}-${Math.random()}`
      setToasts(prev => [...prev, { ...msg, id }])
    }
    return () => { toastHandler = null }
  }, [])

  return { toasts, dismiss }
}
