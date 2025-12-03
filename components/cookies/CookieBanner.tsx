'use client'

import React, { useState } from 'react'
import { CookieConsent } from './CookieConsent'
import { GoogleAnalytics } from './GoogleAnalytics'

export function CookieBanner() {
  const [, setConsentUpdated] = useState(0)

  const handleConsentChange = () => {
    // Trigger re-render av GoogleAnalytics
    setConsentUpdated(prev => prev + 1)
    // Dispatch custom event for andre komponenter
    window.dispatchEvent(new Event('cookieConsentChanged'))
  }

  return (
    <>
      <GoogleAnalytics />
      <CookieConsent onConsentChange={handleConsentChange} />
    </>
  )
}

