'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import OrderedList from '@tiptap/extension-ordered-list'
import BulletList from '@tiptap/extension-bullet-list'
import { Bold, Italic, List, ListOrdered, Type, Highlighter, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

const TOOLBAR_BUTTON =
  'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-sm font-medium text-gray-600 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-300 dark:hover:bg-gray-800'

const LIST_STYLES = [
  { value: 'disc', label: 'Punktliste' },
  { value: 'decimal', label: 'Tall' },
  { value: 'lower-alpha', label: 'Bokstaver' }
]

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [listStyle, setListStyle] = useState<'disc' | 'decimal' | 'lower-alpha'>('disc')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: false,
        orderedList: false
      }),
      BulletList.extend({
        addAttributes() {
          return {
            style: {
              default: 'list-style-type: disc;'
            }
          }
        }
      }),
      OrderedList.extend({
        addAttributes() {
          return {
            style: {
              default: 'list-style-type: decimal;'
            }
          }
        }
      }),
      TextStyle.configure({ types: ['textStyle'] }),
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg my-4 max-h-[360px]'
        }
      })
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'min-h-[240px] w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    }
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', false)
    }
  }, [editor, value])

  useEffect(() => {
    if (!editor) return

    if (listStyle === 'disc') {
      editor.chain().focus().updateAttributes('bulletList', { style: 'list-style-type: disc;' }).run()
    } else if (listStyle === 'decimal') {
      editor.chain().focus().updateAttributes('orderedList', { style: 'list-style-type: decimal;' }).run()
    } else if (listStyle === 'lower-alpha') {
      editor.chain().focus().updateAttributes('orderedList', { style: 'list-style-type: lower-alpha;' }).run()
    }
  }, [editor, listStyle])

  const applyImage = useCallback(
    async (file: File) => {
      const uploadToast = toast.loading('Laster opp bilde...')

      try {
        const fileName = `module-images/${Date.now()}-${file.name}`

        const { data, error } = await supabase.storage
          .from('learning-content')
          .upload(fileName, file)

        if (error) throw error

        const { data: urlData, error: urlError } = supabase.storage
          .from('learning-content')
          .getPublicUrl(fileName)

        if (urlError) throw urlError

        const publicUrl = urlData.publicUrl

        editor?.chain().focus().setImage({ src: publicUrl, alt: file.name }).run()

        toast.success('Bilde lastet opp!')
        toast.dismiss(uploadToast)
      } catch (error: any) {
        console.error('Image upload failed', error)
        toast.error('Kunne ikke laste opp bilde.')
        toast.dismiss(uploadToast)
      }
    },
    [editor]
  )

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Kun bildefiler er tillatt')
      return
    }

    await applyImage(file)
    event.target.value = ''
  }

  if (!editor) {
    return (
      <div className={cn('rounded-lg border border-gray-200 bg-white p-4 text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400', className)}>
        Laster editor...
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(TOOLBAR_BUTTON, editor.isActive('bold') && 'bg-gray-200 dark:bg-gray-800')}
          aria-label="Fet tekst"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(TOOLBAR_BUTTON, editor.isActive('italic') && 'bg-gray-200 dark:bg-gray-800')}
          aria-label="Kursiv tekst"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={cn(TOOLBAR_BUTTON, editor.isActive('highlight') && 'bg-gray-200 dark:bg-gray-800')}
          aria-label="Marker tekst"
        >
          <Highlighter className="h-4 w-4" />
        </button>

        <select
          className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          value={['paragraph', 'heading'].find((type) => editor.isActive(type, { level: 1 })) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
          onChange={(event) => {
            const level = event.target.value
            if (level === 'p') {
              editor.chain().focus().setParagraph().run()
            } else {
              editor.chain().focus().toggleHeading({ level: Number(level.replace('h', '')) as 1 | 2 | 3 }).run()
            }
          }}
        >
          <option value="p">Brødtekst</option>
          <option value="h1">Overskrift 1</option>
          <option value="h2">Overskrift 2</option>
          <option value="h3">Overskrift 3</option>
        </select>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={cn(TOOLBAR_BUTTON, editor.isActive({ textAlign: 'left' }) && 'bg-gray-200 dark:bg-gray-800')}
            aria-label="Venstrejuster"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={cn(TOOLBAR_BUTTON, editor.isActive({ textAlign: 'center' }) && 'bg-gray-200 dark:bg-gray-800')}
            aria-label="Midtstill"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={cn(TOOLBAR_BUTTON, editor.isActive({ textAlign: 'right' }) && 'bg-gray-200 dark:bg-gray-800')}
            aria-label="Høyrejuster"
          >
            <AlignRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(TOOLBAR_BUTTON, editor.isActive('bulletList') && 'bg-gray-200 dark:bg-gray-800')}
            aria-label="Punktliste"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(TOOLBAR_BUTTON, editor.isActive('orderedList') && 'bg-gray-200 dark:bg-gray-800')}
            aria-label="Nummerert liste"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <select
            className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            value={listStyle}
            onChange={(event) => setListStyle(event.target.value as typeof listStyle)}
          >
            {LIST_STYLES.map((style) => (
              <option key={style.value} value={style.value}>
                {style.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus-within:ring-2 focus-within:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          <Type className="h-4 w-4" />
          <input
            type="color"
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
            value={editor.getAttributes('textStyle').color || '#ffffff'}
            title="Tekstfarge"
            className="h-6 w-10 border-0 bg-transparent p-0"
          />
        </label>

        <label className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus-within:ring-2 focus-within:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          <Sparkles className="h-4 w-4" />
          <input
            type="color"
            onChange={(event) => editor.chain().focus().setHighlight({ color: event.target.value }).run()}
            value={editor.isActive('highlight') ? editor.getAttributes('highlight').color || '#ffc078' : '#ffc078'}
            title="Bakgrunnsfarge"
            className="h-6 w-10 border-0 bg-transparent p-0"
          />
        </label>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={TOOLBAR_BUTTON}
          aria-label="Sett inn bilde"
        >
          <ImageIcon className="h-4 w-4" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <EditorContent editor={editor} />

      {placeholder && !editor.getText().length && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{placeholder}</p>
      )}
    </div>
  )
}

