'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Shield, Cookie, BarChart3, Lock, Mail } from 'lucide-react'
import { useCookieConsent } from '@/components/cookies/CookieConsent'
import { toast } from 'sonner'

export default function PrivacyPage() {
  const { consent, updateConsent } = useCookieConsent()

  const handleConsentChange = (value: 'all' | 'necessary') => {
    updateConsent(value)
    window.dispatchEvent(new Event('cookieConsentChanged'))
    toast.success('Cookie-innstillinger oppdatert')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Personvern og cookies</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Informasjon om hvordan vi behandler dine data og bruker informasjonskapsler
        </p>
      </div>

      {/* Cookie innstillinger */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dine cookie-innstillinger</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Du kan når som helst endre dine preferanser for informasjonskapsler.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <Button
                variant={consent === 'necessary' ? 'primary' : 'secondary'}
                onClick={() => handleConsentChange('necessary')}
              >
                Kun nødvendige
              </Button>
              <Button
                variant={consent === 'all' ? 'primary' : 'secondary'}
                onClick={() => handleConsentChange('all')}
              >
                Godta alle
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hvilke cookies bruker vi */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hvilke informasjonskapsler bruker vi?</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Nødvendige cookies */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-green-600" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Nødvendige cookies</h3>
                <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">
                  Alltid aktive
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Disse er essensielle for at nettsiden skal fungere og kan ikke deaktiveres.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 ml-4">
                <li>• <strong>Autentisering:</strong> Holder deg innlogget</li>
                <li>• <strong>Tema-preferanse:</strong> Husker lys/mørk modus</li>
                <li>• <strong>Cookie-samtykke:</strong> Husker ditt valg for cookies</li>
              </ul>
            </div>

            {/* Analyse cookies */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Analyse-cookies</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  consent === 'all' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {consent === 'all' ? 'Aktive' : 'Deaktiverte'}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Disse hjelper oss å forstå hvordan besøkende bruker nettsiden, slik at vi kan forbedre den.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 ml-4">
                <li>• <strong>Google Analytics:</strong> Samler anonym statistikk om sidevisninger, 
                  enhetstype, og navigasjon. IP-adresser anonymiseres.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Databehandling */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hvordan behandler vi dine data?</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
            <p>
              Vi tar personvern på alvor og følger GDPR (Personvernforordningen). 
              Her er hovedpunktene for hvordan vi behandler dine data:
            </p>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Hvilke data samler vi inn?</h4>
                <p>Vi samler inn informasjon du gir oss ved registrering (navn, e-post) samt 
                  data om din fremgang i kurs og opplæring.</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Hvorfor samler vi inn data?</h4>
                <p>For å levere tjenesten, spore opplæringsfremdrift, og forbedre brukeropplevelsen.</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Hvem deler vi data med?</h4>
                <p>Vi deler ikke personopplysninger med tredjeparter, bortsett fra tjenesteleverandører 
                  som er nødvendige for å drifte tjenesten (hosting, e-post).</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Dine rettigheter</h4>
                <p>Du har rett til innsyn, retting, sletting og dataportabilitet. 
                  Kontakt oss for å utøve disse rettighetene.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kontakt */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kontakt oss</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Har du spørsmål om personvern eller ønsker å utøve dine rettigheter? 
            Ta kontakt med oss på <a href="mailto:personvern@kompetanseportalen.no" className="text-primary-600 hover:underline">personvern@kompetanseportalen.no</a>
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Sist oppdatert: {new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>
  )
}

