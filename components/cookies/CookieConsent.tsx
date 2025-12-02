'use client'

import React, { useState, useEffect } from 'react'

export type CookieConsentValue = 'all' | 'necessary' | null

interface CookieConsentProps {
  onConsentChange?: (consent: CookieConsentValue) => void
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsentValue>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('cookieConsent') as CookieConsentValue
    setConsent(stored)
    setIsLoaded(true)
  }, [])

  const updateConsent = (value: CookieConsentValue) => {
    if (value) {
      localStorage.setItem('cookieConsent', value)
    } else {
      localStorage.removeItem('cookieConsent')
    }
    setConsent(value)
  }

  return { consent, isLoaded, updateConsent }
}

export function CookieConsent({ onConsentChange }: CookieConsentProps) {
  const { consent, isLoaded, updateConsent } = useCookieConsent()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isLoaded && consent === null) {
      // Liten forsinkelse for bedre UX
      const timer = setTimeout(() => setIsVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [isLoaded, consent])

  const handleConsent = (value: CookieConsentValue) => {
    updateConsent(value)
    setIsVisible(false)
    onConsentChange?.(value)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-4xl mx-auto bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
              🍪 Vi bruker informasjonskapsler
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Vi bruker informasjonskapsler for å analysere trafikk og forbedre brukeropplevelsen. 
              Du kan velge å kun godta nødvendige cookies, eller godta alle for å hjelpe oss med å forbedre tjenesten.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={() => handleConsent('necessary')}
              className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors"
            >
              Kun nødvendige
            </button>
            <button
              onClick={() => handleConsent('all')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Godta alle
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

