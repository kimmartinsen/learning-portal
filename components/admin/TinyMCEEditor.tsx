'use client'

import { Editor } from '@tinymce/tinymce-react'
import type { IAllProps } from '@tinymce/tinymce-react'

interface TinyMCEEditorProps extends Partial<IAllProps> {
  value?: string
  onEditorChange?: (content: string, editor: unknown) => void
  init?: Record<string, unknown>
}

export default function TinyMCEEditor(props: TinyMCEEditorProps) {
  return <Editor {...props} />
}

