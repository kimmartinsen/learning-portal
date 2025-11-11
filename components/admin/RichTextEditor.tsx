'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import OrderedList from '@tiptap/extension-ordered-list'
import BulletList from '@tiptap/extension-bullet-list'
import { Bold, Italic, List, Type, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
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
  { value: 'none', label: 'Ingen liste' },
  { value: 'disc', label: 'Punktliste' },
  { value: 'decimal', label: 'Tall' },
  { value: 'lower-alpha', label: 'Bokstaver' }
] as const

const FONT_SIZES = [
  { value: '14px', label: '14 px' },
  { value: '16px', label: '16 px' },
  { value: '18px', label: '18 px' },
  { value: '22px', label: '22 px' },
  { value: '28px', label: '28 px' }
] as const

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [listStyle, setListStyle] = useState<(typeof LIST_STYLES)[number]['value']>('none')
  const [fontSize, setFontSize] = useState('16px')
  const [imageControls, setImageControls] = useState<{
    visible: boolean
    width: number
    float: 'none' | 'left' | 'right' | 'center'
  }>({ visible: false, width: 80, float: 'none' })

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
      TextStyle,
      Color,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg my-4 max-h-[480px]'
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

    if (listStyle === 'none') {
      editor.chain().focus().unsetOrderedList().unsetBulletList().run()
    } else if (listStyle === 'disc') {
      editor.chain().focus().setBulletList().updateAttributes('bulletList', { style: 'list-style-type: disc;' }).run()
    } else if (listStyle === 'decimal') {
      editor.chain().focus().setOrderedList().updateAttributes('orderedList', { style: 'list-style-type: decimal;' }).run()
    } else if (listStyle === 'lower-alpha') {
      editor.chain().focus().setOrderedList().updateAttributes('orderedList', { style: 'list-style-type: lower-alpha;' }).run()
    }
  }, [editor, listStyle])

  useEffect(() => {
    if (!editor) return

    const updateStates = () => {
      const attrs = editor.getAttributes('textStyle')
      if (attrs?.fontSize) {
        setFontSize(attrs.fontSize)
      } else {
        setFontSize('16px')
      }

      if (editor.isActive('bulletList')) {
        setListStyle('disc')
      } else if (editor.isActive('orderedList', { style: 'list-style-type: lower-alpha;' })) {
        setListStyle('lower-alpha')
      } else if (editor.isActive('orderedList')) {
        setListStyle('decimal')
      } else {
        setListStyle('none')
      }

      if (editor.isActive('image')) {
        const imageAttrs = editor.getAttributes('image') as { width?: string; style?: string }
        const widthValue = imageAttrs.width ? parseInt(imageAttrs.width.replace('%', ''), 10) : 80
        let float: 'none' | 'left' | 'right' | 'center' = 'none'
        if (imageAttrs.style?.includes('float: left')) float = 'left'
        else if (imageAttrs.style?.includes('float: right')) float = 'right'
        else if (imageAttrs.style?.includes('margin: 0 auto')) float = 'center'

        setImageControls({
          visible: true,
          width: Number.isNaN(widthValue) ? 80 : widthValue,
          float
        })
      editor.chain().focus().updateAttributes('bulletList', { style: 'list-style-type: disc;' }).run()
      } else {
        setImageControls((prev) => ({ ...prev, visible: false }))
      }
    }

    editor.on('selectionUpdate', updateStates)
    editor.on('transaction', updateStates)

    return () => {
      editor.off('selectionUpdate', updateStates)
      editor.off('transaction', updateStates)
    }
  }, [editor])

  const applyImage = useCallback(
    async (file: File) => {
      const uploadToast = toast.loading('Laster opp bilde...')

      try {
        const fileName = `module-images/${Date.now()}-${file.name}`

        const { data, error } = await supabase.storage
          .from('learning-content')
          .upload(fileName, file)

        if (error) throw error

        const { data: urlData } = supabase.storage
          .from('learning-content')
          .getPublicUrl(fileName)

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

        <select
          className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          value={fontSize}
          onChange={(event) => {
            const size = event.target.value
            setFontSize(size)
            editor.chain().focus().setMark('textStyle', { fontSize: size }).run()
          }}
        >
          {FONT_SIZES.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>

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

      {imageControls.visible && (
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-300">Bredde</span>
            <input
              type="range"
              min={20}
              max={100}
              value={imageControls.width}
              onChange={(event) => {
                const width = Number(event.target.value)
                setImageControls((prev) => ({ ...prev, width }))
                editor
                  ?.chain()
                  .focus()
                  .updateAttributes('image', {
                    width: `${width}%`,
                    style:
                      imageControls.float === 'left'
                        ? `width: ${width}%; float: left; margin: 0 1rem 1rem 0;`
                        : imageControls.float === 'right'
                          ? `width: ${width}%; float: right; margin: 0 0 1rem 1rem;`
                          : imageControls.float === 'center'
                            ? `width: ${width}%; display: block; margin: 1rem auto;`
                            : `width: ${width}%; display: block; margin: 1.5rem auto;`
                  })
                  .run()
              }}
              className="w-40"
            />
            <span className="w-10 text-right text-gray-600 dark:text-gray-300">{imageControls.width}%</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setImageControls((prev) => ({ ...prev, float: 'left' }))
                editor
                  ?.chain()
                  .focus()
                  .updateAttributes('image', {
                    style: `width: ${imageControls.width}%; float: left; margin: 0 1rem 1rem 0;`
                  })
                  .run()
              }}
              className={cn(TOOLBAR_BUTTON, 'w-10', imageControls.float === 'left' && 'bg-gray-200 dark:bg-gray-800')}
              aria-label="Flyt til venstre"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setImageControls((prev) => ({ ...prev, float: 'center' }))
                editor
                  ?.chain()
                  .focus()
                  .updateAttributes('image', {
                    style: `width: ${imageControls.width}%; display: block; margin: 1rem auto;`
                  })
                  .run()
              }}
              className={cn(TOOLBAR_BUTTON, 'w-10', imageControls.float === 'center' && 'bg-gray-200 dark:bg-gray-800')}
              aria-label="Sentrer"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setImageControls((prev) => ({ ...prev, float: 'right' }))
                editor
                  ?.chain()
                  .focus()
                  .updateAttributes('image', {
                    style: `width: ${imageControls.width}%; float: right; margin: 0 0 1rem 1rem;`
                  })
                  .run()
              }}
              className={cn(TOOLBAR_BUTTON, 'w-10', imageControls.float === 'right' && 'bg-gray-200 dark:bg-gray-800')}
              aria-label="Flyt til høyre"
            >
              <AlignRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setImageControls((prev) => ({ ...prev, float: 'none' }))
                editor
                  ?.chain()
                  .focus()
                  .updateAttributes('image', {
                    style: `width: ${imageControls.width}%; display: block; margin: 1.5rem auto;`
                  })
                  .run()
              }}
              className={cn(
                TOOLBAR_BUTTON,
                'w-16 text-xs',
                imageControls.float === 'none' && 'bg-gray-200 dark:bg-gray-800'
              )}
            >
              Standard
            </button>
          </div>
        </div>
      )}

      {placeholder && !editor.getText().length && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{placeholder}</p>
      )}
    </div>
  )
}

