import './globals.css'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { CookieBanner } from '@/components/cookies/CookieBanner'

const inter = Inter({ subsets: ['latin'] })

const themeScript = `
(function() {
  try {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`

export const metadata = {
  title: 'Kompetanseportalen',
  description: 'Komplett opplæringsverktøy for bedrifter. Opprett kurs, sjekklister og følg opp kompetansen til dine ansatte.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="no" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <CookieBanner />
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
