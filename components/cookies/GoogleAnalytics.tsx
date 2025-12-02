'use client'

import React, { useEffect, useState } from 'react'
import Script from 'next/script'

const GA_MEASUREMENT_ID = 'G-S5G7VT1N0R'

export function GoogleAnalytics() {
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent')
    setHasConsent(consent === 'all')

    // Lytt etter endringer i samtykke
    const handleStorageChange = () => {
      const newConsent = localStorage.getItem('cookieConsent')
      setHasConsent(newConsent === 'all')
    }

    window.addEventListener('storage', handleStorageChange)
    
    // Custom event for når samtykke endres i samme vindu
    window.addEventListener('cookieConsentChanged', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('cookieConsentChanged', handleStorageChange)
    }
  }, [])

  if (!hasConsent) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            anonymize_ip: true
          });
        `}
      </Script>
    </>
  )
}

