'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ isOpen, onClose, children, size = 'md' }: ModalProps) {
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

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="absolute inset-0 bg-black/70" 
        onClick={onClose}
        aria-label="Lukk dialog"
      />
      <div 
        className={`relative z-10 w-full ${sizeClasses[size]} max-h-[85vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    portalRef.current
  )
}

