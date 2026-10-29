import { BrowserWindow, dialog } from 'electron'
import AdmZip from 'adm-zip'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { EpubChapter, EpubExportData, ExportResult, ManuscriptExportPayload } from '../shared/types'

function safeFileName(value: string): string {
  return value.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'manuscrito'
}

function markdownToText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '· ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toXhtml(html: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': '&#160;',
    '&mdash;': '&#8212;',
    '&ndash;': '&#8211;',
    '&hellip;': '&#8230;',
    '&ldquo;': '&#8220;',
    '&rdquo;': '&#8221;',
    '&lsquo;': '&#8216;',
    '&rsquo;': '&#8217;',
    '&middot;': '&#183;',
    '&bull;': '&#8226;',
    '&copy;': '&#169;',
    '&reg;': '&#174;',
    '&trade;': '&#8482;'
  }
  let output = html
  for (const [entity, numeric] of Object.entries(entities)) {
    output = output.replace(new RegExp(entity, 'gi'), numeric)
  }
  output = output.replace(/<(br|hr|img|input|col|area|base|embed|link|meta|param|source|track|wbr)(\b[^>]*?)\/?>/gi, '<$1$2/>')
  output = output.replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|amp;|lt;|gt;|quot;|apos;)/g, '&amp;')
  return output
}

function languageCode(language: string): string {
  const normalized = language.trim().toLowerCase()
  if (normalized.startsWith('es')) return 'es'
  if (normalized.startsWith('en')) return 'en'
  if (normalized.startsWith('fr')) return 'fr'
  if (normalized.startsWith('de')) return 'de'
  if (normalized.startsWith('pt')) return 'pt'
  if (normalized.startsWith('it')) return 'it'
  return 'es'
}

function parseImageDataUrl(value?: string): { data: Buffer; extension: string; mediaType: string } | null {
  if (!value) return null
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(value)
  if (!match) return null
  const mediaType = (match[1] || 'image/jpeg').toLowerCase()
  if (!mediaType.startsWith('image/')) return null
  const data = match[2]
    ? Buffer.from(match[3], 'base64')
    : Buffer.from(decodeURIComponent(match[3]), 'utf8')
  if (!data.length) return null
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg'
  }
  return { data, extension: extensions[mediaType] || 'jpg', mediaType }
}

function buildEpub(title: string, coverImage: string | undefined, data: EpubExportData): Buffer {
  const language = languageCode(data.language)
  const image = parseImageDataUrl(coverImage)
  const chapters: EpubChapter[] = data.chapters.length
    ? data.chapters
    : [{ title: 'Manuscrito', html: '<p>Sin contenido.</p>' }]
  const showTitlePage = data.includeTitlePage || Boolean(image)
  const navItems: string[] = []
  const manifest: string[] = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="css" href="style.css" media-type="text/css"/>'
  ]
  const spine: string[] = []

  if (showTitlePage) {
    navItems.push('<li><a href="titlepage.xhtml">Portada</a></li>')
    manifest.push('<item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>')
    spine.push('<itemref idref="titlepage"/>')
  }
  if (image) {
    manifest.push(
      `<item id="cover-image" href="cover.${image.extension}" media-type="${image.mediaType}" properties="cover-image"/>`
    )
  }
  chapters.forEach((chapter, index) => {
    const id = `chapter-${index + 1}`
    navItems.push(`<li><a href="${id}.xhtml">${xmlEscape(chapter.title)}</a></li>`)
    manifest.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`)
    spine.push(`<itemref idref="${id}"/>`)
  })

  const cover = image
    ? `<div class="cover-wrap"><img src="cover.${image.extension}" alt="Portada"/></div>`
    : ''
  const titleBlock = data.includeTitlePage
    ? `<h1>${xmlEscape(title)}</h1>${
        data.author ? `<p class="author">${xmlEscape(data.author)}</p>` : ''
      }${data.genre ? `<p class="genre">${xmlEscape(data.genre)}</p>` : ''}<div class="rule"></div><p class="mark">NovelCraft</p>`
    : ''
  const synopsis =
    data.includeTitlePage && data.synopsis.trim()
      ? `<section class="synopsis"><h2>Sinopsis</h2><p>${xmlEscape(data.synopsis).replace(/\n/g, '<br/>')}</p></section>`
      : ''
  const titlePage = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head><meta charset="utf-8"/><title>${xmlEscape(title)}</title><link rel="stylesheet" href="style.css"/></head>
<body><section epub:type="titlepage" class="titlepage">${cover}${titleBlock}</section>${synopsis}</body>
</html>`

  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head><meta charset="utf-8"/><title>Contenido</title><link rel="stylesheet" href="style.css"/></head>
<body><nav epub:type="toc" id="toc"><h1>Contenido</h1><ol>${navItems.join('')}</ol></nav></body>
</html>`

  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const description = data.synopsis.trim() ? `<dc:description>${xmlEscape(data.synopsis)}</dc:description>` : ''
  const creator = data.author.trim() ? `<dc:creator>${xmlEscape(data.author)}</dc:creator>` : ''
  const subject = data.genre.trim() ? `<dc:subject>${xmlEscape(data.genre)}</dc:subject>` : ''
  const coverMeta = image ? '<meta name="cover" content="cover-image"/>' : ''
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${language}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">urn:uuid:${randomUUID()}</dc:identifier>
<dc:title>${xmlEscape(title)}</dc:title>
<dc:language>${language}</dc:language>
${creator}
${subject}
${description}
<meta property="dcterms:modified">${modified}</meta>
${coverMeta}
</metadata>
<manifest>${manifest.join('')}</manifest>
<spine toc="nav">${spine.join('')}</spine>
</package>`

  const style = `body { margin: 5% 7%; color: #1e1b17; font-family: Georgia, 'Times New Roman', serif; font-size: 1em; line-height: 1.68; }
h1, h2, h3 { font-weight: normal; line-height: 1.2; }
h1 { font-size: 2em; margin: 0 0 1em; }
h2 { font-size: 1.5em; margin: 1.4em 0 0.7em; }
p { margin: 0 0 0.65em; text-align: justify; }
.titlepage { min-height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }
.cover-wrap { margin-bottom: 2em; }
.cover-wrap img { max-width: 100%; max-height: 70vh; border-radius: 4px; }
.titlepage .author { font-size: 1.1em; letter-spacing: 0.04em; color: #4d463d; text-align: center; }
.titlepage .genre { font-family: sans-serif; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.16em; color: #8d7d68; text-align: center; }
.titlepage .rule { width: 2.5em; height: 1px; background: #b9905d; margin: 1.8em 0; }
.titlepage .mark { font-family: sans-serif; font-size: 0.65em; letter-spacing: 0.2em; text-transform: uppercase; color: #a89a88; text-align: center; }
.synopsis { page-break-after: always; }
.synopsis p { font-style: italic; }
.scene-separator { text-align: center; letter-spacing: 0.6em; color: #9c8f7e; }
.scene-title { font-size: 1.1em; font-style: italic; text-align: center; color: #5c5348; }
blockquote { margin: 1em 2em; font-style: italic; border-left: 2px solid #d8c8b3; padding-left: 1em; }
img { max-width: 100%; height: auto; }
`

  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`

  const zip = new AdmZip(undefined, { noSort: true })
  zip.addFile('mimetype', Buffer.from('application/epub+zip'))
  const mimetype = zip.getEntry('mimetype')
  if (mimetype) mimetype.header.method = 0
  zip.addFile('META-INF/container.xml', Buffer.from(container, 'utf8'))
  zip.addFile('OEBPS/content.opf', Buffer.from(opf, 'utf8'))
  zip.addFile('OEBPS/nav.xhtml', Buffer.from(nav, 'utf8'))
  zip.addFile('OEBPS/style.css', Buffer.from(style, 'utf8'))
  if (showTitlePage) zip.addFile('OEBPS/titlepage.xhtml', Buffer.from(titlePage, 'utf8'))
  if (image) zip.addFile(`OEBPS/cover.${image.extension}`, image.data)
  chapters.forEach((chapter, index) => {
    const id = `chapter-${index + 1}`
    const document = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head><meta charset="utf-8"/><title>${xmlEscape(chapter.title)}</title><link rel="stylesheet" href="style.css"/></head>
<body><section epub:type="chapter">${toXhtml(chapter.html)}</section></body>
</html>`
    zip.addFile(`OEBPS/${id}.xhtml`, Buffer.from(document, 'utf8'))
  })
  return zip.toBuffer()
}

async function renderPdf(html: string): Promise<Buffer> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'novelcraft-pdf-'))
  const tempFile = path.join(tempDir, 'manuscrito.html')
  await fs.writeFile(tempFile, html, 'utf8')
  const printWindow = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      sandbox: true,
      javascript: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  try {
    await printWindow.loadFile(tempFile)
    return await printWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: 'A4',
      margins: { top: 0.7, bottom: 0.7, left: 0.75, right: 0.75 }
    })
  } finally {
    printWindow.destroy()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function exportManuscript(payload: ManuscriptExportPayload): Promise<ExportResult> {
  const extensionMap = {
    pdf: 'pdf',
    html: 'html',
    markdown: 'md',
    txt: 'txt',
    epub: 'epub'
  }
  const filterNames = {
    pdf: 'Documento PDF',
    html: 'Página HTML',
    markdown: 'Markdown',
    txt: 'Texto plano',
    epub: 'Libro electrónico EPUB'
  }
  const extension = extensionMap[payload.format]
  const baseName = safeFileName(payload.title)
  let target = payload.outputPath
  if (!target) {
    const result = await dialog.showSaveDialog({
      title: 'Publicar manuscrito',
      defaultPath: `${baseName}.${extension}`,
      filters: [{ name: filterNames[payload.format], extensions: [extension] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    target = result.filePath
  }
  if (!path.extname(target)) target = `${target}.${extension}`
  if (payload.format === 'epub') {
    if (!payload.epub) throw new Error('No hay datos EPUB para exportar.')
    const buffer = buildEpub(payload.title, payload.coverImage, payload.epub)
    await fs.writeFile(target, buffer)
  } else if (payload.format === 'pdf') {
    const buffer = await renderPdf(payload.html)
    await fs.writeFile(target, buffer)
  } else if (payload.format === 'html') {
    await fs.writeFile(target, payload.html, 'utf8')
  } else if (payload.format === 'markdown') {
    await fs.writeFile(target, payload.markdown, 'utf8')
  } else {
    await fs.writeFile(target, markdownToText(payload.markdown), 'utf8')
  }
  return { canceled: false, filePath: target }
}
