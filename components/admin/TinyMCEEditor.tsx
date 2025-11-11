'use client'

import { Editor } from '@tinymce/tinymce-react'
import type { EditorProps } from '@tinymce/tinymce-react'

export default function TinyMCEEditor(props: EditorProps) {
  return <Editor {...props} />
}

