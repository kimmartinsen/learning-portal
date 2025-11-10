import './globals.css'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

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
  title: 'Opplæringsportal',
  description: 'Komplett opplæringsportal for bedrifter',
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
