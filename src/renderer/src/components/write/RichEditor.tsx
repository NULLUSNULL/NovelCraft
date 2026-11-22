import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Typography from '@tiptap/extension-typography'
import { Color, FontFamily, TextStyle } from '@tiptap/extension-text-style'
import type { Editor } from '@tiptap/react'
import type { DocumentNode, EntityKind, ID } from '@shared/types'
import { AI_ACTION_PROMPTS, buildProjectContext, countWords, type AiActionMeta } from '@shared/project'
import { getAiSkillPrompt } from '@shared/aiSkills'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BookOpen,
  Bold,
  ChevronDown,
  Code2,
  Copy,
  Highlighter,
  ListChecks,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquare,
  Minus,
  PenLine,
  Quote,
  Redo2,
  RemoveFormatting,
  Sparkles,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  UsersRound
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { Modal } from '../ui/Modal'

interface RichEditorProps {
  node: DocumentNode
  content: string
  editable?: boolean
  onChange: (content: string) => void
  onAiRequest: (action: string) => void
  onEditorReady?: (editor: Editor | null) => void
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function RichEditor({ node, content, editable = true, onChange, onAiRequest, onEditorReady }: RichEditorProps) {
  const spellcheck = useAppStore((state) => state.settings.editor.spellcheck)
  const fontSize = useAppStore((state) => state.settings.editor.fontSize)
  const aiEnabled = useAppStore((state) => state.settings.ai.enabled)
  const pushToast = useAppStore((state) => state.pushToast)
  const linkOpenInitially = false
  const [linkOpen, setLinkOpen] = useState(linkOpenInitially)
  const [linkUrl, setLinkUrl] = useState('')
  const [entityLink, setEntityLink] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const updateTimer = useRef<number | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      Link.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            entityKind: {
              default: null,
              parseHTML: (element) => element.getAttribute('data-entity-kind'),
              renderHTML: (attributes) => attributes.entityKind ? { 'data-entity-kind': attributes.entityKind } : {}
            },
            entityId: {
              default: null,
              parseHTML: (element) => element.getAttribute('data-entity-id'),
              renderHTML: (attributes) => attributes.entityId ? { 'data-entity-id': attributes.entityId } : {}
            }
          }
        },
        addCommands() {
          return {
            ...this.parent?.(),
            setEntityLink: (attributes: { href: string; entityKind?: EntityKind | null; entityId?: ID | null }) =>
              ({ chain }) => chain().setLink({ href: attributes.href }).setMark('link', attributes).run()
          }
        }
      }).configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noopener noreferrer' }
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      Placeholder.configure({
        placeholder: node.type === 'note' ? 'Escribe tu nota...' : 'Empieza a escribir. La página en blanco es una promesa...',
        emptyEditorClass: 'is-editor-empty'
      }),
      CharacterCount
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: 'novel-prose',
        spellcheck: spellcheck ? 'true' : 'false'
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML()
      if (updateTimer.current) window.clearTimeout(updateTimer.current)
      updateTimer.current = window.setTimeout(() => {
        onChange(html)
      }, 180)
    }
  })

  useEffect(() => {
    return () => {
      if (updateTimer.current) window.clearTimeout(updateTimer.current)
    }
  }, [])

  useEffect(() => {
    onEditorReady?.(editor ?? null)
    return () => onEditorReady?.(null)
  }, [editor, onEditorReady])

  useEffect(() => {
    if (!editor) return
    if (content !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
    editor.setOptions({
      editorProps: {
        attributes: {
          class: 'novel-prose',
          spellcheck: spellcheck ? 'true' : 'false'
        }
      }
    })
  }, [editable, editor, spellcheck])

  const toolbar = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      underline: current?.isActive('underline') ?? false,
      strike: current?.isActive('strike') ?? false,
      code: current?.isActive('code') ?? false,
      highlight: current?.isActive('highlight') ?? false,
      bulletList: current?.isActive('bulletList') ?? false,
      orderedList: current?.isActive('orderedList') ?? false,
      blockquote: current?.isActive('blockquote') ?? false,
      link: current?.isActive('link') ?? false,
      h1: current?.isActive('heading', { level: 1 }) ?? false,
      h2: current?.isActive('heading', { level: 2 }) ?? false,
      h3: current?.isActive('heading', { level: 3 }) ?? false,
      alignLeft: current?.isActive({ textAlign: 'left' }) ?? false,
      alignCenter: current?.isActive({ textAlign: 'center' }) ?? false,
      alignRight: current?.isActive({ textAlign: 'right' }) ?? false,
      alignJustify: current?.isActive({ textAlign: 'justify' }) ?? false,
      canUndo: current?.can().undo() ?? false,
      canRedo: current?.can().redo() ?? false
    })
  })

  const openLinkDialog = (): void => {
    if (!editor) return
    const attrs = editor.getAttributes('link')
    setLinkUrl(attrs.entityKind && attrs.entityId ? '' : attrs.href || '')
    setEntityLink(attrs.entityKind && attrs.entityId ? `${attrs.entityKind}:${attrs.entityId}` : '')
    setLinkOpen(true)
  }

  const applyLink = (): void => {
    if (!editor) return
    const url = linkUrl.trim()
    const [kind, ...idParts] = entityLink.split(':')
    const id = idParts.join(':')
    const validKind = kind === 'character' || kind === 'location' || kind === 'item'
    const project = useAppStore.getState().project
    const collection = kind === 'character' ? project?.characters : kind === 'location' ? project?.locations : kind === 'item' ? project?.items : undefined
    if (validKind && id && collection?.some((entity) => entity.id === id)) {
      editor.chain().focus().extendMarkRange('link').setEntityLink({
        href: `novelcraft://entity/${kind}/${encodeURIComponent(id)}`,
        entityKind: kind satisfies EntityKind,
        entityId: id satisfies ID
      }).run()
    } else if (url) {
      editor.chain().focus().extendMarkRange('link').setEntityLink({ href: url, entityKind: null, entityId: null }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
    setLinkOpen(false)
  }

  const linkEntityMentions = (): void => {
    if (!editor) return
    const project = useAppStore.getState().project
    if (!project) return
    const entities = [
      ...project.characters.map((entity) => ({ kind: 'character' as const, id: entity.id, name: entity.name.trim() })),
      ...project.locations.map((entity) => ({ kind: 'location' as const, id: entity.id, name: entity.name.trim() })),
      ...project.items.map((entity) => ({ kind: 'item' as const, id: entity.id, name: entity.name.trim() }))
    ].filter((entity) => entity.name.length > 0)
    const nameCounts = new Map<string, number>()
    for (const entity of entities) {
      const key = entity.name.toLocaleLowerCase()
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1)
    }
    const ambiguousNameCount = [...nameCounts.values()].filter((count) => count > 1).length
    const candidates = entities
      .filter((entity) => nameCounts.get(entity.name.toLocaleLowerCase()) === 1)
      .sort((a, b) => b.name.length - a.name.length)
    const linkMark = editor.state.schema.marks.link
    if (!linkMark) return
    const transaction = editor.state.tr
    let linkedCount = 0

    editor.state.doc.descendants((textNode, position) => {
      const text = textNode.text
      if (!textNode.isText || typeof text !== 'string' || textNode.marks.some((mark) => mark.type === linkMark)) return
      const occupied = new Array<boolean>(text.length).fill(false)
      for (const entity of candidates) {
        const escapedName = entity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const matcher = new RegExp(`(?<![\\p{L}\\p{N}_])${escapedName}(?![\\p{L}\\p{N}_])`, 'giu')
        for (const match of text.matchAll(matcher)) {
          const start = match.index
          const end = start + match[0].length
          if (occupied.slice(start, end).some(Boolean)) continue
          occupied.fill(true, start, end)
          transaction.addMark(
            position + start,
            position + end,
            linkMark.create({
              href: `novelcraft://entity/${entity.kind}/${encodeURIComponent(entity.id)}`,
              entityKind: entity.kind,
              entityId: entity.id,
              rel: 'noopener noreferrer'
            })
          )
          linkedCount += 1
        }
      }
    })

    if (transaction.docChanged) editor.view.dispatch(transaction)
    pushToast(
      `${linkedCount
        ? `${linkedCount} ${linkedCount === 1 ? 'mención vinculada' : 'menciones vinculadas'} al Códex.`
        : 'No se encontraron menciones nuevas sin enlazar.'}${ambiguousNameCount ? ` Se omitieron ${ambiguousNameCount} ${ambiguousNameCount === 1 ? 'nombre duplicado' : 'nombres duplicados'} para evitar enlaces ambiguos.` : ''}`,
      linkedCount ? 'success' : 'info'
    )
  }

  const clearFormatting = (): void => {
    if (!editor) return
    editor.chain().focus().unsetAllMarks().clearNodes().run()
  }

  const blockValue = toolbar?.h1 ? 'h1' : toolbar?.h2 ? 'h2' : toolbar?.h3 ? 'h3' : 'p'

  const copySelection = async (): Promise<void> => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, '\n')
    if (text) await navigator.clipboard.writeText(text)
  }

  const cutSelection = async (): Promise<void> => {
    if (!editor) return
    await copySelection()
    editor.chain().focus().deleteSelection().run()
  }

  const paste = async (): Promise<void> => {
    if (!editor) return
    const text = await navigator.clipboard.readText()
    if (text) editor.chain().focus().insertContent(textToHtml(text)).run()
  }

  const contextItems = (): ContextMenuItem[] => {
    const selection = editor?.state.selection
    const hasSelection = Boolean(selection && selection.from !== selection.to)
    const aiEnabled = useAppStore.getState().settings.ai.enabled && useAppStore.getState().settings.ai.selectionActions
    const items: ContextMenuItem[] = [
      { id: 'copy', label: 'Copiar', icon: <Copy size={13} />, shortcut: 'Ctrl C', action: () => void copySelection() },
      { id: 'cut', label: 'Cortar', icon: <Minus size={13} />, shortcut: 'Ctrl X', action: () => void cutSelection(), disabled: !hasSelection },
      { id: 'paste', label: 'Pegar', icon: <Copy size={13} />, shortcut: 'Ctrl V', action: () => void paste() },
      { id: 'sep', divider: true }
    ]
    if (editor && !editable) return items
    if (aiEnabled) {
      const groupOrder: AiActionMeta['group'][] = ['Reescribir', 'Desarrollar', 'Revisar e idear']
      const groupIcons: Record<AiActionMeta['group'], ReactNode> = {
        Reescribir: <PenLine size={13} />,
        Desarrollar: <BookOpen size={13} />,
        'Revisar e idear': <ListChecks size={13} />
      }
      items.push({ id: 'ai-head', heading: true, label: 'Asistencia IA' })
      for (const group of groupOrder) {
        const children = Object.entries(AI_ACTION_PROMPTS)
          .filter(([, meta]) => meta.group === group)
          .map(([key, meta]) => ({
            id: `ai-${key}`,
            label: meta.label,
            icon: <Sparkles size={13} />,
            disabled: !hasSelection && !['continue', 'brainstorm'].includes(key),
            action: () => onAiRequest(key)
          }))
        if (children.length) {
          items.push({ id: `ai-group-${group}`, label: group, icon: groupIcons[group], children })
        }
      }
      items.push(
        { id: 'ai-sep', divider: true },
        {
          id: 'ai-custom',
          label: 'Instrucción personalizada...',
          icon: <MessageSquare size={13} />,
          action: () => onAiRequest('custom')
        }
      )
    }
    return items
  }

  if (!editor) return null

  return (
    <div className="rich-editor" data-testid="rich-editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Formato de texto">
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={() => editor.chain().focus().undo().run()} disabled={!toolbar?.canUndo} title="Deshacer (Ctrl+Z)">
            <Undo2 size={14} />
          </button>
          <button className="toolbar-btn" onClick={() => editor.chain().focus().redo().run()} disabled={!toolbar?.canRedo} title="Rehacer (Ctrl+Shift+Z)">
            <Redo2 size={14} />
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group block-select-group">
          <select
            className="toolbar-select"
            value={blockValue}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'p') editor.chain().focus().setParagraph().run()
              else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run()
            }}
            title="Estilo de párrafo"
          >
            <option value="p">Párrafo</option>
            <option value="h1">Título 1</option>
            <option value="h2">Título 2</option>
            <option value="h3">Título 3</option>
          </select>
          <ChevronDown size={11} className="toolbar-select-arrow" />
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button className={`toolbar-btn ${toolbar?.bold ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita (Ctrl+B)">
            <Bold size={14} />
          </button>
          <button className={`toolbar-btn ${toolbar?.italic ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva (Ctrl+I)">
            <Italic size={14} />
          </button>
          <button className={`toolbar-btn ${toolbar?.underline ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado (Ctrl+U)">
            <UnderlineIcon size={14} />
          </button>
          <button className={`toolbar-btn ${toolbar?.strike ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
            <Strikethrough size={14} />
          </button>
          <button className={`toolbar-btn ${toolbar?.code ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleCode().run()} title="Código en línea">
            <Code2 size={14} />
          </button>
          <button className={`toolbar-btn ${toolbar?.highlight ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleHighlight({ color: '#d7a56855' }).run()} title="Resaltar">
            <Highlighter size={14} />
          </button>
          <label className="toolbar-color" title="Color del texto">
            <span>A</span>
            <input type="color" defaultValue="#d7a568" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
          </label>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button className={`toolbar-btn ${toolbar?.bulletList ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista con viñetas">
            <List size={14} />
          </button>
          <button className={`toolbar-btn ${toolbar?.orderedList ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
            <ListOrdered size={14} />
          </button>
          <button className={`toolbar-btn ${toolbar?.blockquote ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita">
            <Quote size={14} />
          </button>
          <button className="toolbar-btn" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separador">
            <Minus size={14} />
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button className={`toolbar-btn ${toolbar?.alignLeft ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinear izquierda">
            <AlignLeft size={14} />
          </button>
          <button className={`toolbar-btn ${toolbar?.alignCenter ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centrar">
            <AlignCenter size={14} />
          </button>
          <button className={`toolbar-btn ${toolbar?.alignRight ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinear derecha">
            <AlignRight size={14} />
          </button>
          <button className={`toolbar-btn ${toolbar?.alignJustify ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar">
            <AlignJustify size={14} />
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button className={`toolbar-btn ${toolbar?.link ? 'active' : ''}`} onClick={openLinkDialog} title="Enlace">
            <Link2 size={14} />
          </button>
          <button className="toolbar-btn" onClick={linkEntityMentions} disabled={!editable} title="Vincular menciones del Códex" aria-label="Vincular menciones del Códex">
            <UsersRound size={14} />
          </button>
          <button className="toolbar-btn" onClick={clearFormatting} title="Borrar formato">
            <RemoveFormatting size={14} />
          </button>
        </div>
        <div className="toolbar-spacer" />
      </div>

      <BubbleMenu
        editor={editor}
        className="bubble-menu"
        shouldShow={({ state }) => state.selection.from !== state.selection.to}
      >
        <button className={editor.isActive('bold') ? 'active' : ''} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita">
          <Bold size={13} />
        </button>
        <button className={editor.isActive('italic') ? 'active' : ''} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva">
          <Italic size={13} />
        </button>
        <button className={editor.isActive('underline') ? 'active' : ''} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado">
          <UnderlineIcon size={13} />
        </button>
        <button className={editor.isActive('highlight') ? 'active' : ''} onClick={() => editor.chain().focus().toggleHighlight({ color: '#d7a56855' }).run()} title="Resaltar">
          <Highlighter size={13} />
        </button>
        {aiEnabled && (
          <>
            <span className="bubble-sep" />
            <button className="bubble-ai" onClick={() => onAiRequest('improve')}>
              <Sparkles size={12} />
              IA
            </button>
          </>
        )}
      </BubbleMenu>

      <div
        className="editor-paper"
        style={{ fontSize: `${fontSize}px` }}
        onContextMenu={(event) => {
          if (!editor) return
          event.preventDefault()
          setContextMenu({ x: event.clientX, y: event.clientY })
        }}
        onClick={(event) => {
          const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-entity-kind][data-entity-id]')
          if (!anchor) return
          const kind = anchor.dataset.entityKind
          const id = anchor.dataset.entityId
          if (!id || (kind !== 'character' && kind !== 'location' && kind !== 'item')) return
          event.preventDefault()
          const project = useAppStore.getState().project
          const entities = kind === 'character' ? project?.characters : kind === 'location' ? project?.locations : project?.items
          if (!entities?.some((entity) => entity.id === id)) return
          useAppStore.getState().selectEntity(kind, id)
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Insertar enlace"
        size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setLinkOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={applyLink}>Aplicar enlace</button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="editor-entity-link">Registro del códice (opcional)</label>
          <select
            id="editor-entity-link"
            className="input"
            value={entityLink}
            onChange={(event) => setEntityLink(event.target.value)}
          >
            <option value="">Enlace web</option>
            {(['character', 'location', 'item'] as const).map((kind) => {
              const project = useAppStore.getState().project
              const entities = kind === 'character' ? project?.characters : kind === 'location' ? project?.locations : project?.items
              const label = kind === 'character' ? 'Characters' : kind === 'location' ? 'Locations' : 'Items'
              return entities?.length ? (
                <optgroup key={kind} label={label}>
                  {entities.map((entity) => <option key={entity.id} value={`${kind}:${entity.id}`}>{entity.name}</option>)}
                </optgroup>
              ) : null
            })}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Dirección web</label>
          <input
            className="input"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://..."
            disabled={Boolean(entityLink)}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyLink()
            }}
          />
          <span className="field-hint">Deja el campo vacío para quitar el enlace del texto seleccionado.</span>
        </div>
      </Modal>
    </div>
  )
}

export function AiActionDialog({
  node,
  action,
  range,
  text,
  editor,
  onClose
}: {
  node: DocumentNode
  action: string
  range: { from: number; to: number }
  text: string
  editor: Editor | null
  onClose: () => void
}) {
  const project = useAppStore((state) => state.project)
  const settings = useAppStore((state) => state.settings)
  const pushToast = useAppStore((state) => state.pushToast)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const selectedAction = action
  const [customInstruction, setCustomInstruction] = useState('')
  const [extraInstruction, setExtraInstruction] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const actionMeta = AI_ACTION_PROMPTS[selectedAction]
  const isCustom = selectedAction === 'custom'
  const provider = settings.providers.find((item) => item.id === settings.ai.activeProviderId)

  const generate = async (): Promise<void> => {
    if (!project) return
    if (!provider) {
      setSettingsOpen(true)
      pushToast('Configura un proveedor de IA para empezar.', 'error')
      return
    }
    setLoading(true)
    setError('')
    setResult('')
    try {
      const context = buildProjectContext(project, node.id, settings.ai)
      const baseInstruction = isCustom
        ? customInstruction.trim() || 'Ayúdame a mejorar este fragmento.'
        : actionMeta.instruction
      const instruction = extraInstruction.trim()
        ? `${baseInstruction}\n\nINDICACIONES ADICIONALES DEL AUTOR:\n${extraInstruction.trim()}`
        : baseInstruction
      const system = `${getAiSkillPrompt('editorial-action')}\n\nIDIOMA DE RESPUESTA: ${project.language}`
      const user = `CONTEXTO DEL PROYECTO:\n${context}\n\nFRAGMENTO:\n"""${text || '(sin selección)'}"""\n\nINSTRUCCIÓN:\n${instruction}`
      const response = await window.novelcraft.aiComplete({
        providerId: provider.id,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.75,
        maxTokens: 2000
      })
      setResult(response.content.trim())
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(caught)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const insertResult = (replace: boolean): void => {
    if (!editor || !result) return
    const html = textToHtml(result)
    if (replace && range.from !== range.to) {
      editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, html).run()
    } else {
      editor.chain().focus().insertContentAt(range.to, html).run()
    }
    onClose()
    pushToast('Texto insertado.', 'success')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={actionMeta?.label || 'Instrucción personalizada'}
      subtitle={provider ? `${provider.name} · ${provider.model}` : 'Configura un proveedor en Ajustes → IA'}
      size="lg"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cerrar</button>
          {result && (
            <>
              <button
                className="btn"
                onClick={() => {
                  void navigator.clipboard.writeText(result)
                  pushToast('Resultado copiado.', 'success')
                }}
              >
                Copiar
              </button>
              <button className="btn" onClick={() => insertResult(false)}>
                Insertar después
              </button>
              <button className="btn btn-primary" onClick={() => insertResult(true)} disabled={range.from === range.to}>
                Reemplazar selección
              </button>
            </>
          )}
          {!result && (
            <button className="btn btn-primary" onClick={() => void generate()} disabled={loading}>
              {loading ? <span className="spinner" /> : <Sparkles size={14} />}
              {loading ? 'Generando...' : 'Generar'}
            </button>
          )}
        </>
      }
    >
      <div className="ai-dialog-body">
        <div className="ai-dialog-options">
          <div className="field">
            <label className="field-label">Acción</label>
            <div className="ai-action-name">{actionMeta?.label || 'Instrucción personalizada'}</div>
            <span className="field-hint">{actionMeta?.instruction || 'Describe qué quieres que haga la IA con el fragmento.'}</span>
          </div>
          {isCustom && (
            <div className="field mt-12">
              <label className="field-label">Tu instrucción</label>
              <textarea
                className="textarea"
                value={customInstruction}
                onChange={(event) => setCustomInstruction(event.target.value)}
                placeholder="Ej. Reescribe este diálogo con más tensión y menos palabras."
                rows={3}
              />
            </div>
          )}
          {actionMeta?.allowInstructions && (
            <div className="field mt-12">
              <label className="field-label">Instrucciones adicionales <span className="faint">(opcional)</span></label>
              <textarea
                className="textarea"
                value={extraInstruction}
                onChange={(event) => setExtraInstruction(event.target.value)}
                placeholder="Ej. Añade tensión, mantén el punto de vista de Marta o termina con una pregunta."
                rows={3}
              />
            </div>
          )}
        </div>
        <div className="ai-dialog-fragment">
          <div className="field-label">Fragmento {text ? `· ${text.split(/\s+/).length} palabras` : 'sin selección'}</div>
          <div className="ai-fragment-preview">{text || 'El cursor está al final del documento. La IA continuará desde aquí.'}</div>
        </div>
        {error && <div className="inline-error">{error}</div>}
        {result && (
          <div className="ai-dialog-result">
            <div className="field-label">Propuesta</div>
            <textarea className="textarea ai-result-textarea" value={result} onChange={(event) => setResult(event.target.value)} rows={12} />
            <div className="ai-result-note">
              <Sparkles size={11} />
              Revisa siempre las sugerencias: la decisión final sobre tu novela es tuya.
            </div>
          </div>
        )}
        {loading && (
          <div className="ai-loading-panel">
            <span className="spinner lg" />
            <span>La IA está leyendo el contexto de tu novela...</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
