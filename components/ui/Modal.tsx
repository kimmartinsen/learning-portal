'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  const portalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!portalRef.current) {
      portalRef.current = document.createElement('div')
      document.body.appendChild(portalRef.current)
    }

    return () => {
      if (portalRef.current) {
        document.body.removeChild(portalRef.current)
        portalRef.current = null
      }
    }
  }, [])

  if (!isOpen || !portalRef.current) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/70" 
        onClick={onClose}
      />
      <div className="relative z-10 mx-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>,
    portalRef.current
  )
}

