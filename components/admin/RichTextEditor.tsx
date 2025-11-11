'use client'

import { useCallback, useMemo } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import 'tinymce/tinymce'
import 'tinymce/icons/default'
import 'tinymce/themes/silver'
import 'tinymce/models/dom'
import 'tinymce/plugins/autoresize'
import 'tinymce/plugins/advlist'
import 'tinymce/plugins/link'
import 'tinymce/plugins/lists'
import 'tinymce/plugins/image'
import 'tinymce/plugins/table'
import 'tinymce/plugins/code'
import 'tinymce/plugins/quickbars'
import 'tinymce/plugins/paste'

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const fontsizes = '12px 14px 16px 18px 22px 28px 36px'

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

      const { data } = supabase.storage
        .from('learning-content')
        .getPublicUrl(fileName)

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

  const editorInit = useMemo(
    () => ({
      menubar: false,
      branding: false,
      height: 420,
      object_resizing: true,
      automatic_uploads: true,
      images_upload_handler: imagesUploadHandler,
      images_file_types: 'jpeg,jpg,png,gif,webp',
      image_caption: true,
      image_dimensions: true,
      image_advtab: true,
      plugins: [
        'advlist',
        'autoresize',
        'link',
        'lists',
        'image',
        'table',
        'code',
        'quickbars',
        'paste'
      ],
      toolbar:
        'undo redo | bold italic underline forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist | fontsizeselect | link image table | removeformat',
      quickbars_selection_toolbar: 'bold italic | forecolor backcolor | quicklink blockquote',
      fontsize_formats: fontsizes,
      placeholder: placeholder || '',
      content_style: `
        body {
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #111827;
          line-height: 1.6;
          padding: 12px;
        }
        body.dark {
          color: #e5e7eb;
          background-color: #111827;
        }
        img {
          max-width: 100%;
          height: auto;
        }
        body:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
        }
      `,
      skin: 'oxide',
      content_css: 'default'
    }),
    [imagesUploadHandler, placeholder, fontsizes]
  )

  return (
    <div className={className}>
      <Editor
        apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
        value={value}
        init={editorInit}
        onEditorChange={(content) => onChange(content)}
      />
    </div>
  )
}

