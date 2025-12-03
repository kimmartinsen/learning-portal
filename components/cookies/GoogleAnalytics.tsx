'use client'

import React, { useEffect, useState } from 'react'
import Script from 'next/script'

const GA_MEASUREMENT_ID = 'G-S5G7VT1N0R'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

export function GoogleAnalytics() {
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    const consent = getCookie('cookieConsent')
    setHasConsent(consent === 'all')

    // Lytt etter endringer i samtykke
    const handleConsentChange = () => {
      const newConsent = getCookie('cookieConsent')
      setHasConsent(newConsent === 'all')
    }
    
    // Custom event for når samtykke endres
    window.addEventListener('cookieConsentChanged', handleConsentChange)

    return () => {
      window.removeEventListener('cookieConsentChanged', handleConsentChange)
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

