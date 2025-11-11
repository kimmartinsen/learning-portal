'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Editor as TinyMCEInstance } from 'tinymce'

const TinyEditor = dynamic(() => import('./TinyMCEEditor'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
      Laster editor...
    </div>
  )
})

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    const update = () => setIsDark(root.classList.contains('dark'))
    update()

    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const imagesUploadHandler = useCallback(async (blobInfo: any) => {
    const file = blobInfo.blob()
    const fileName = `module-images/${Date.now()}-${blobInfo.filename()}`
    const uploadToast = toast.loading('Laster opp bilde...')

    try {
      const { error } = await supabase.storage
        .from('learning-content')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        })

      if (error) {
        throw error
      }

      const { data } = supabase.storage.from('learning-content').getPublicUrl(fileName)
      toast.success('Bilde lastet opp!')
      toast.dismiss(uploadToast)
      return data.publicUrl
    } catch (error: any) {
      console.error('Image upload failed', error)
      toast.error('Kunne ikke laste opp bilde.')
      toast.dismiss(uploadToast)
      throw error
    }
  }, [])

  const placeholderText = (placeholder || 'Skriv innhold her...').replace(/'/g, "\\'")

  const editorInit = useMemo(
    () => ({
      menubar: false,
      branding: false,
      height: 420,
      object_resizing: 'img',
      toolbar_mode: 'wrap',
      toolbar_sticky: true,
      automatic_uploads: true,
      images_upload_handler: imagesUploadHandler,
      images_file_types: 'jpeg,jpg,png,gif,webp',
      image_caption: true,
      image_dimensions: true,
      image_advtab: true,
      image_title: true,
      image_class_list: [
        { title: 'Standard', value: '' },
        { title: 'Flyt venstre', value: 'float-left' },
        { title: 'Flyt høyre', value: 'float-right' },
        { title: 'Sentrert', value: 'float-center' }
      ],
      plugins: 'advlist autolink lists link image table code autoresize',
      toolbar:
        'undo redo | formatselect fontsizeselect | bold italic underline forecolor backcolor removeformat | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image table | code',
      fontsize_formats: '12px 14px 16px 18px 20px 22px 24px 28px 32px 36px',
      style_formats: [
        { title: 'Avsnitt', format: 'p' },
        { title: 'Overskrift 2', format: 'h2' },
        { title: 'Overskrift 3', format: 'h3' },
        { title: 'Sitater', format: 'blockquote' }
      ],
      setup: (editor: TinyMCEInstance) => {
        editor.on('init', () => {
          const body = editor.getBody()
          if (body) {
            body.setAttribute('data-placeholder', placeholderText)
          }
        })
      },
      content_style: `
        :root { color-scheme: ${isDark ? 'dark' : 'light'}; }
        body {
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: ${isDark ? '#e5e7eb' : '#111827'};
          background-color: ${isDark ? '#111827' : '#ffffff'};
          line-height: 1.7;
          padding: 12px;
        }
        img {
          max-width: 100%;
          height: auto;
        }
        .float-left {
          float: left;
          margin: 0 1rem 1rem 0;
        }
        .float-right {
          float: right;
          margin: 0 0 1rem 1rem;
        }
        .float-center {
          display: block;
          margin: 1rem auto;
          text-align: center;
        }
        body.mce-content-body:empty::before {
          content: '${placeholderText}';
          color: ${isDark ? '#6b7280' : '#9ca3af'};
        }
      `,
      skin: isDark ? 'oxide-dark' : 'oxide',
      content_css: isDark ? 'dark' : 'default'
    }),
    [imagesUploadHandler, isDark, placeholderText]
  )

  return (
    <div className={className}>
      <TinyEditor
        apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
        value={value}
        init={editorInit}
        onEditorChange={(content: string) => onChange(content)}
        tinymceScriptSrc="https://cdn.jsdelivr.net/npm/tinymce@7.2.1/tinymce.min.js"
      />
    </div>
  )
}

