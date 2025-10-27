import './globals.css'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

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
    <html lang="no">
      <body className={inter.className}>
        {children}
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
        />
      </body>
    </html>
  )
}
