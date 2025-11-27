import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Resend API for e-postutsending
// Installer: npm install resend
// Legg til RESEND_API_KEY i .env

const RESEND_API_KEY = process.env.RESEND_API_KEY

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY ikke satt - e-post vil ikke bli sendt')
    return { success: false, error: 'E-posttjeneste ikke konfigurert' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Opplæringsportal <noreply@opplæringsportal.no>',
        to: [to],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Kunne ikke sende e-post')
    }

    const data = await response.json()
    return { success: true, id: data.id }
  } catch (error: any) {
    console.error('Error sending email:', error)
    return { success: false, error: error.message }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, fullName, tempPassword, companyName } = body

    if (!email || !fullName || !tempPassword) {
      return NextResponse.json(
        { error: 'Mangler påkrevde felter' },
        { status: 400 }
      )
    }

    // Generer e-post HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Velkommen til Opplæringsportalen</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin: 0;">Velkommen til Opplæringsportalen!</h1>
          </div>
          
          <p>Hei ${fullName},</p>
          
          <p>Din konto i Opplæringsportalen har blitt opprettet. Du kan nå logge inn med følgende opplysninger:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>E-post:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Midlertidig passord:</strong> <code style="background-color: #fff; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
          </div>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>⚠️ Viktig:</strong> Du må endre passordet ditt ved første innlogging for å sikre kontoen din.</p>
          </div>
          
          <p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://opplæringsportal.no'}/login" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Logg inn nå
            </a>
          </p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Hvis du ikke har bedt om denne kontoen, kan du ignorere denne e-posten.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #666; font-size: 12px;">
            ${companyName ? `Dette er en automatisk melding fra ${companyName}.` : 'Dette er en automatisk melding fra Opplæringsportalen.'}
          </p>
        </body>
      </html>
    `

    // Send e-post
    const result = await sendEmail(
      email,
      'Velkommen til Opplæringsportalen - Din konto er opprettet',
      emailHtml
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Kunne ikke sende e-post' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'E-post sendt',
      emailId: result.id 
    })
  } catch (error: any) {
    console.error('Error in send-welcome-email:', error)
    return NextResponse.json(
      { error: error.message || 'Kunne ikke sende e-post' },
      { status: 500 }
    )
  }
}

