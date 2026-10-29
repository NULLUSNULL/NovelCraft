import { useMemo, useState } from 'react'
import {
  BookCheck,
  BookMarked,
  BookOpen,
  Check,
  Download,
  FileCode2,
  FileText,
  FileType2,
  Loader2,
  Printer,
  Sparkles
} from 'lucide-react'
import TurndownService from 'turndown'
import type { DocumentNode, ManuscriptFormat } from '@shared/types'
import {
  countWords,
  formatNumber,
  getManuscriptChapters,
  getManuscriptScenes,
  stripHtml
} from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { Switch } from '../ui/Modal'

interface CompileOptions {
  titlePage: boolean
  chapterTitles: boolean
  sceneTitles: boolean
  sceneSeparators: boolean
  finalOnly: boolean
  synopsis: boolean
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeContent(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((element) => element.remove())
  doc.body.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.startsWith('on')) element.removeAttribute(attribute.name)
      if (attribute.name === 'href' && attribute.value.trim().toLowerCase().startsWith('javascript:')) {
        element.removeAttribute('href')
      }
    }
  })
  return doc.body.innerHTML
}

function buildMarkdown(
  title: string,
  author: string,
  genre: string,
  synopsis: string,
  chapters: Array<{ chapter: DocumentNode; scenes: DocumentNode[] }>,
  options: CompileOptions
): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    emDelimiter: '*',
    codeBlockStyle: 'fenced'
  })
  turndown.addRule('paragraphSpacing', {
    filter: 'p',
    replacement: (content) => `\n\n${content.trim()}\n\n`
  })
  const parts: string[] = []
  if (options.titlePage) {
    parts.push(`# ${title}\n\n${author ? `**${author}**\n\n` : ''}${genre ? `*${genre}*\n\n` : ''}`)
  }
  if (options.synopsis && synopsis.trim()) {
    parts.push(`## Sinopsis\n\n${synopsis.trim()}\n\n`)
  }
  for (const { chapter, scenes } of chapters) {
    if (options.chapterTitles) parts.push(`\n\n# ${chapter.title}\n\n`)
    if (chapter.summary && options.synopsis) parts.push(`*${chapter.summary}*\n\n`)
    for (const scene of scenes) {
      if (options.sceneTitles) parts.push(`\n\n## ${scene.title}\n\n`)
      else if (options.sceneSeparators) parts.push('\n\n---\n\n')
      parts.push(turndown.turndown(sanitizeContent(scene.content)))
      parts.push('\n\n')
    }
  }
  return parts.join('').replace(/\n{4,}/g, '\n\n\n').trim() + '\n'
}

function buildEpubChapters(
  chapters: Array<{ chapter: DocumentNode; scenes: DocumentNode[] }>,
  options: CompileOptions
): Array<{ title: string; html: string }> {
  return chapters.map(({ chapter, scenes }, chapterIndex) => {
    const parts: string[] = []
    if (options.chapterTitles) {
      parts.push(`<h1>Capítulo ${chapterIndex + 1}. ${escapeHtml(chapter.title)}</h1>`)
    }
    if (chapter.summary && options.synopsis) {
      parts.push(`<p class="chapter-summary"><em>${escapeHtml(chapter.summary)}</em></p>`)
    }
    for (const scene of scenes) {
      if (options.sceneSeparators) parts.push('<p class="scene-separator">⁂</p>')
      if (options.sceneTitles) parts.push(`<h2 class="scene-title">${escapeHtml(scene.title)}</h2>`)
      parts.push(`<div class="scene-content">${sanitizeContent(scene.content)}</div>`)
    }
    return {
      title: options.chapterTitles ? chapter.title : `Capítulo ${chapterIndex + 1}`,
      html: parts.join('') || '<p></p>'
    }
  })
}

function buildPrintHtml(
  projectTitle: string,
  author: string,
  genre: string,
  synopsis: string,
  coverImage: string,
  chapters: Array<{ chapter: DocumentNode; scenes: DocumentNode[] }>,
  options: CompileOptions
): string {
  const titleCover = coverImage ? `<img class="title-cover" src="${coverImage.replace(/"/g, '&quot;')}" alt="Portada">` : ''
  const titlePage = options.titlePage
    ? `<section class="title-page">${titleCover}<p class="title-kicker">Novela</p><h1>${escapeHtml(projectTitle)}</h1><p class="title-author">${escapeHtml(author || '')}</p><p class="title-genre">${escapeHtml(genre)}</p><div class="title-rule"></div><p class="title-mark">NovelCraft</p></section>`
    : ''
  const synopsisBlock =
    options.synopsis && synopsis.trim()
      ? `<section class="synopsis-page"><h2>Sinopsis</h2><p>${escapeHtml(synopsis).replace(/\n/g, '<br>')}</p></section>`
      : ''
  const body = chapters
    .map(({ chapter, scenes }, chapterIndex) => {
      const chapterHeading = options.chapterTitles
        ? `<header class="chapter-heading"><p class="chapter-number">Capítulo ${chapterIndex + 1}</p><h2>${escapeHtml(chapter.title)}</h2></header>`
        : ''
      const sceneHtml = scenes
        .map((scene) => {
          const sceneTitle = options.sceneTitles ? `<h3 class="scene-title">${escapeHtml(scene.title)}</h3>` : ''
          const separator = options.sceneSeparators ? '<div class="scene-separator">⁂</div>' : ''
          return `${separator}${sceneTitle}<div class="scene-content">${sanitizeContent(scene.content)}</div>`
        })
        .join('')
      return `<section class="chapter">${chapterHeading}${sceneHtml}</section>`
    })
    .join('')
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(projectTitle)}</title>
<style>
@page { size: A4; margin: 22mm 24mm 24mm 24mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #1e1b17; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 11.5pt; line-height: 1.75; }
.title-page { height: 92vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }
.title-cover { max-width: 52%; max-height: 46vh; object-fit: cover; border-radius: 3px; margin-bottom: 22pt; box-shadow: 0 8px 26px rgba(0, 0, 0, 0.18); }
.title-kicker { font-family: Helvetica, Arial, sans-serif; font-size: 8pt; letter-spacing: .35em; text-transform: uppercase; color: #8b6b45; margin-bottom: 26pt; }
.title-page h1 { font-size: 34pt; font-weight: normal; letter-spacing: -.02em; margin: 0 0 16pt; max-width: 80%; line-height: 1.1; }
.title-author { font-size: 14pt; letter-spacing: .06em; color: #4d463d; }
.title-genre { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; text-transform: uppercase; letter-spacing: .17em; color: #9a8d7d; margin-top: 7pt; }
.title-rule { width: 36pt; height: 1px; background: #b9905d; margin: 30pt 0; }
.title-mark { font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; letter-spacing: .25em; text-transform: uppercase; color: #b0a596; }
.synopsis-page { page-break-after: always; padding-top: 15vh; max-width: 85%; margin: 0 auto; }
.synopsis-page h2 { font-size: 20pt; font-weight: normal; margin-bottom: 16pt; }
.synopsis-page p { font-style: italic; color: #4a433a; }
.chapter { page-break-before: always; }
.chapter:first-of-type { page-break-before: auto; }
.chapter-heading { text-align: center; margin: 8vh 0 9vh; }
.chapter-number { font-family: Helvetica, Arial, sans-serif; font-size: 8pt; letter-spacing: .24em; text-transform: uppercase; color: #a2835b; margin-bottom: 9pt; }
.chapter-heading h2 { font-size: 24pt; font-weight: normal; letter-spacing: -.015em; margin: 0; }
.scene-title { font-size: 13pt; font-weight: normal; font-style: italic; text-align: center; margin: 22pt 0 14pt; color: #5c5348; }
.scene-content p { margin: 0 0 0.2em; text-indent: 1.5em; text-align: justify; orphans: 3; widows: 3; }
.scene-content p:first-child { text-indent: 0; }
.scene-content p:first-child::first-letter { font-size: 2.3em; float: left; line-height: .85; padding-right: .08em; padding-top: .08em; }
.scene-content h1, .scene-content h2, .scene-content h3 { font-weight: normal; margin: 1.2em 0 .5em; text-align: left; }
.scene-content blockquote { margin: 1em 2em; font-style: italic; border-left: 2px solid #d8c8b3; padding-left: 1em; }
.scene-content ul, .scene-content ol { margin: .8em 0; }
.scene-content hr { border: none; text-align: center; margin: 1.5em 0; }
.scene-content hr::after { content: '⁂'; letter-spacing: 1em; }
.scene-separator { text-align: center; margin: 23pt 0 10pt; color: #9c8f7e; font-size: 12pt; }
</style>
</head>
<body>
${titlePage}
${synopsisBlock}
${body}
</body>
</html>`
}

const FORMATS = [
  { format: 'pdf' as const, label: 'PDF', description: 'Listo para imprimir o leer', icon: FileType2 },
  { format: 'epub' as const, label: 'EPUB', description: 'Libro electrónico con portada', icon: BookMarked },
  { format: 'html' as const, label: 'HTML', description: 'Página web con estilos', icon: FileCode2 },
  { format: 'markdown' as const, label: 'Markdown', description: 'Editable y portátil', icon: FileText },
  { format: 'txt' as const, label: 'Texto', description: 'Compatibilidad total', icon: FileText }
]

export function PublishView() {
  const project = useAppStore((state) => state.project)
  const pushToast = useAppStore((state) => state.pushToast)
  const [options, setOptions] = useState<CompileOptions>({
    titlePage: true,
    chapterTitles: true,
    sceneTitles: false,
    sceneSeparators: true,
    finalOnly: false,
    synopsis: true
  })
  const [previewMode, setPreviewMode] = useState<'page' | 'markdown'>('page')
  const [exporting, setExporting] = useState('')

  const compiled = useMemo(() => {
    if (!project) return { chapters: [], words: 0, scenes: 0, markdown: '', html: '', epubChapters: [] }
    const chapters = getManuscriptChapters(project)
      .map((chapter) => ({
        chapter,
        scenes: Object.values(project.nodes)
          .filter((node) => node.parentId === chapter.id && node.type === 'scene')
          .sort((a, b) => a.order - b.order)
          .filter((scene) => scene.content && (!options.finalOnly || scene.status === 'final'))
      }))
      .filter(({ scenes }) => scenes.length > 0)
    const words = chapters.reduce((total, { scenes }) => total + scenes.reduce((count, scene) => count + countWords(scene.content), 0), 0)
    const sceneCount = chapters.reduce((total, { scenes }) => total + scenes.length, 0)
    const markdown = buildMarkdown(project.title, project.author, project.genre, project.synopsis, chapters, options)
    const html = buildPrintHtml(project.title, project.author, project.genre, project.synopsis, project.coverImage || '', chapters, options)
    const epubChapters = buildEpubChapters(chapters, options)
    return { chapters, words, scenes: sceneCount, markdown, html, epubChapters }
  }, [project, options])

  if (!project) return null
  const allScenes = getManuscriptScenes(project)
  const finalScenes = allScenes.filter((scene) => scene.status === 'final')
  const pages = Math.max(1, Math.ceil(compiled.words / 300))

  const toggle = (key: keyof CompileOptions): void => setOptions((current) => ({ ...current, [key]: !current[key] }))

  const exportBook = async (format: ManuscriptFormat): Promise<void> => {
    setExporting(format)
    try {
      const result = await window.novelcraft.exportManuscript({
        html: compiled.html,
        markdown: compiled.markdown,
        title: project.title,
        coverImage: project.coverImage,
        format,
        epub: {
          author: project.author,
          genre: project.genre,
          language: project.language,
          synopsis: project.synopsis,
          includeTitlePage: options.titlePage,
          chapters: compiled.epubChapters
        }
      })
      if (!result.canceled) pushToast(`Manuscrito exportado${result.filePath ? `: ${result.filePath}` : ''}`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setExporting('')
    }
  }

  return (
    <div className="publish-view">
      <header className="publish-header">
        <div>
          <div className="card-eyebrow">Publicación</div>
          <h1>Compila tu manuscrito</h1>
          <p>Prepara una versión limpia de tu novela para lectores, beta readers o imprenta.</p>
        </div>
        <div className="publish-header-stats">
          <div><strong>{formatNumber(compiled.words)}</strong><span>palabras</span></div>
          <div><strong>{compiled.chapters.length}</strong><span>capítulos</span></div>
          <div><strong>~{pages}</strong><span>páginas</span></div>
        </div>
      </header>

      <div className="publish-layout">
        <aside className="publish-options">
          <div className="publish-option-group">
            <h3>Contenido</h3>
            <div className="publish-toggle-row">
              <div><strong>Portada</strong><span>Página de título y autoría</span></div>
              <Switch checked={options.titlePage} onChange={() => toggle('titlePage')} />
            </div>
            <div className="publish-toggle-row">
              <div><strong>Sinopsis</strong><span>Incluye la sinopsis del proyecto</span></div>
              <Switch checked={options.synopsis} onChange={() => toggle('synopsis')} />
            </div>
            <div className="publish-toggle-row">
              <div><strong>Títulos de capítulo</strong><span>Encabezados y numeración</span></div>
              <Switch checked={options.chapterTitles} onChange={() => toggle('chapterTitles')} />
            </div>
            <div className="publish-toggle-row">
              <div><strong>Títulos de escena</strong><span>Muestra el nombre de cada escena</span></div>
              <Switch checked={options.sceneTitles} onChange={() => toggle('sceneTitles')} />
            </div>
            <div className="publish-toggle-row">
              <div><strong>Separadores</strong><span>Marca el inicio de cada escena</span></div>
              <Switch checked={options.sceneSeparators} onChange={() => toggle('sceneSeparators')} />
            </div>
            <div className="publish-toggle-row">
              <div><strong>Solo escenas finales</strong><span>{finalScenes.length} de {allScenes.length} marcadas como final</span></div>
              <Switch checked={options.finalOnly} onChange={() => toggle('finalOnly')} />
            </div>
          </div>

          <div className="publish-option-group">
            <h3>Formato de salida</h3>
            <div className="format-grid">
              {FORMATS.map(({ format, label, description, icon: Icon }) => (
                <button className="format-card" key={format} onClick={() => void exportBook(format)} disabled={Boolean(exporting)}>
                  {exporting === format ? <Loader2 size={17} className="spin" style={{ animation: 'spin 800ms linear infinite' }} /> : <Icon size={17} />}
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <Download size={12} />
                </button>
              ))}
            </div>
          </div>

          <div className="publish-readiness">
            <div className="publish-readiness-head">
              <BookCheck size={14} />
              <strong>Estado de preparación</strong>
            </div>
            <div className="readiness-row">
              <span className={project.synopsis ? 'good' : ''}>{project.synopsis ? <Check size={11} /> : '○'}</span>
              Sinopsis
            </div>
            <div className="readiness-row">
              <span className={compiled.scenes > 0 ? 'good' : ''}>{compiled.scenes > 0 ? <Check size={11} /> : '○'}</span>
              Escenas incluidas ({compiled.scenes})
            </div>
            <div className="readiness-row">
              <span className={finalScenes.length > 0 ? 'good' : ''}>{finalScenes.length > 0 ? <Check size={11} /> : '○'}</span>
              Escenas finalizadas ({finalScenes.length})
            </div>
            {options.finalOnly && compiled.scenes === 0 && (
              <div className="publish-warning">No hay escenas finales incluidas. Desactiva el filtro o marca escenas como «Final».</div>
            )}
          </div>
        </aside>

        <section className="publish-preview-panel">
          <div className="publish-preview-head">
            <div className="segmented">
              <button className={previewMode === 'page' ? 'active' : ''} onClick={() => setPreviewMode('page')}>
                <BookOpen size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                Vista de página
              </button>
              <button className={previewMode === 'markdown' ? 'active' : ''} onClick={() => setPreviewMode('markdown')}>
                <FileCode2 size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                Markdown
              </button>
            </div>
            <div className="publish-preview-meta">
              <Printer size={12} />
              A4 · ~{pages} páginas
            </div>
          </div>
          <div className="publish-preview-scroll">
            {previewMode === 'page' ? (
              <div className="publish-paper">
                {options.titlePage && (
                  <div className="preview-title-page">
                    {project.coverImage && <img className="preview-cover-image" src={project.coverImage} alt={`Portada de ${project.title}`} />}
                    <span className="preview-kicker">Novela</span>
                    <h1>{project.title}</h1>
                    <p>{project.author}</p>
                    <small>{project.genre}</small>
                    <div className="preview-title-rule" />
                    <em>NovelCraft</em>
                  </div>
                )}
                {options.synopsis && project.synopsis && (
                  <div className="preview-synopsis">
                    <h3>Sinopsis</h3>
                    <p>{project.synopsis}</p>
                  </div>
                )}
                {compiled.chapters.map(({ chapter, scenes }, chapterIndex) => (
                  <div className="preview-chapter" key={chapter.id}>
                    {options.chapterTitles && (
                      <header>
                        <span>Capítulo {chapterIndex + 1}</span>
                        <h2>{chapter.title}</h2>
                      </header>
                    )}
                    {scenes.map((scene) => (
                      <div className="preview-scene" key={scene.id}>
                        {options.sceneSeparators && <div className="preview-scene-sep">⁂</div>}
                        {options.sceneTitles && <h3>{scene.title}</h3>}
                        <div className="preview-scene-content" dangerouslySetInnerHTML={{ __html: sanitizeContent(scene.content) }} />
                      </div>
                    ))}
                  </div>
                ))}
                {!compiled.chapters.length && (
                  <div className="publish-empty-preview">
                    <Sparkles size={20} />
                    <p>No hay escenas para mostrar con los filtros actuales.</p>
                  </div>
                )}
              </div>
            ) : (
              <pre className="publish-markdown">{compiled.markdown}</pre>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
