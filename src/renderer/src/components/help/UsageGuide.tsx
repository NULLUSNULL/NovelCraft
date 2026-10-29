import { useMemo, useState } from 'react'
import { Search, X, Lightbulb } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useAppStore } from '../../store/useAppStore'
import { GUIDE_SECTIONS, guideLanguage } from './guideContent'

const ICONS: Record<string, string> = {
  feather: '🪶',
  library: '📚',
  layout: '🗂️',
  pen: '✒️',
  users: '👥',
  gitbranch: '🕸️',
  sparkles: '✨',
  history: '🕓',
  book: '📖',
  sliders: '🎚️',
  keyboard: '⌨️',
  lightbulb: '💡'
}

export function UsageGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const language = useAppStore((state) => state.settings.general.language)
  const [sectionId, setSectionId] = useState(GUIDE_SECTIONS[0].id)
  const [query, setQuery] = useState('')

  const lang = guideLanguage(language)
  const t = (es: string, en: string): string => (lang === 'es' ? es : en)

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GUIDE_SECTIONS
    return GUIDE_SECTIONS.filter((section) => {
      const haystack = [
        section.title[lang],
        ...section.body[lang],
        ...section.tips[lang]
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query, lang])

  const active = sections.some((section) => section.id === sectionId) ? sectionId : sections[0]?.id ?? ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={t('Guía de uso', 'User guide')}
      subtitle={t('Todas las funcionalidades de NovelCraft, con consejos.', 'Every NovelCraft feature, with tips.')}
    >
      <div className="guide">
        <div className="guide-search">
          <Search size={14} />
          <input
            type="text"
            value={query}
            placeholder={t('Buscar en la guía…', 'Search the guide…')}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button className="guide-search-clear" onClick={() => setQuery('')} aria-label={t('Limpiar', 'Clear')}>
              <X size={13} />
            </button>
          )}
        </div>
        <div className="guide-layout">
          <nav className="guide-nav" aria-label={t('Secciones de la guía', 'Guide sections')}>
            {sections.map((section) => (
              <button
                key={section.id}
                className={`guide-nav-item ${section.id === active ? 'active' : ''}`}
                onClick={() => setSectionId(section.id)}
              >
                <span aria-hidden="true">{ICONS[section.icon] ?? '•'}</span>
                {section.title[lang]}
              </button>
            ))}
            {!sections.length && <p className="guide-empty">{t('Sin resultados para tu búsqueda.', 'No results for your search.')}</p>}
          </nav>
          <div className="guide-content">
            {sections
              .filter((section) => section.id === active)
              .map((section) => (
                <article key={section.id}>
                  <h4>{section.title[lang]}</h4>
                  {section.body[lang].map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                  {section.tips[lang].length > 0 && (
                    <div className="guide-tips">
                      <div className="guide-tips-title">
                        <Lightbulb size={13} />
                        {t('Consejos', 'Tips')}
                      </div>
                      <ul>
                        {section.tips[lang].map((tip, index) => (
                          <li key={index}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
