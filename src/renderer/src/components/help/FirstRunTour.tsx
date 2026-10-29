import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'

interface TourStep {
  emoji: string
  title: { es: string; en: string }
  text: { es: string; en: string }
}

const STEPS: TourStep[] = [
  {
    emoji: '🪶',
    title: { es: 'Bienvenido a NovelCraft', en: 'Welcome to NovelCraft' },
    text: {
      es: 'Un estudio literario completo para planificar, escribir y publicar novelas. Todo se guarda en tu disco, en archivos abiertos: nada depende de una cuenta o de la nube.',
      en: 'A complete literary studio to plan, write and publish novels. Everything is stored on your disk in open files: nothing depends on an account or the cloud.'
    }
  },
  {
    emoji: '📚',
    title: { es: 'Tu biblioteca', en: 'Your library' },
    text: {
      es: 'Cada novela es un proyecto con portada, objetivo de palabras y progreso. Crea el tuyo desde "Nuevo proyecto", o genera el "Proyecto de ejemplo" para explorar con datos reales. Importa y exporta archivos .novelcraft como copia portable.',
      en: 'Every novel is a project with a cover, word goal and progress. Create yours from "New project", or generate the "Sample project" to explore with real data. Import and export .novelcraft files as a portable copy.'
    }
  },
  {
    emoji: '✒️',
    title: { es: 'Escribe sin fricción', en: 'Write without friction' },
    text: {
      es: 'El editor guarda cada cambio automáticamente y guarda instantáneas del historial de cada escena. Usa el modo concentración (Ctrl + Shift + F) y la paleta de comandos (Ctrl + K) para moverte rápido.',
      en: 'The editor saves every change automatically and keeps snapshots of each scene history. Use focus mode (Ctrl + Shift + F) and the command palette (Ctrl + K) to move fast.'
    }
  },
  {
    emoji: '👥',
    title: { es: 'Códex y tramas', en: 'Codex and plots' },
    text: {
      es: 'En el códex viven personajes, lugares y objetos; enlazan con tus escenas automáticamente. El tablero de tramas conecta los hilos narrativos con líneas de causa, conflicto o convergencia.',
      en: 'Characters, locations and items live in the codex; they link to your scenes automatically. The plot board connects story threads with cause, conflict or convergence lines.'
    }
  },
  {
    emoji: '✨',
    title: { es: 'IA opcional, tuya al completo', en: 'Optional AI, fully yours' },
    text: {
      es: 'Conecta Ollama o LM Studio para asistirte sin salir de tu equipo, o un proveedor en la nube si lo prefieres. Se configura en Ajustes → IA, con acciones sobre cualquier selección de texto.',
      en: 'Connect Ollama or LM Studio to get assistance without leaving your machine, or a cloud provider if you prefer. Configure it in Settings → AI, with actions over any text selection.'
    }
  },
  {
    emoji: '🛡️',
    title: { es: 'Nada se pierde', en: 'Nothing is lost' },
    text: {
      es: 'Copias de seguridad automáticas y manuales por proyecto, papelera con retención y exportación a PDF, EPUB, Markdown y más. Puedes ajustar todo en Ajustes, incluido el tamaño de la interfaz.',
      en: 'Automatic and manual backups per project, a trash with retention, and export to PDF, EPUB, Markdown and more. You can tune everything in Settings, including the interface size.'
    }
  },
  {
    emoji: '🚀',
    title: { es: 'Listo para empezar', en: 'Ready to start' },
    text: {
      es: 'Vuelve a esta guía cuando quieras: está en Ajustes → Acerca de → "Guía de uso". ¡Feliz escritura!',
      en: 'Come back to this guide anytime: it lives in Settings → About → "User guide". Happy writing!'
    }
  }
]

export function FirstRunTour(): React.JSX.Element | null {
  const booted = useAppStore((state) => state.booted)
  const bootError = useAppStore((state) => state.bootError)
  const tourCompleted = useAppStore((state) => state.settings.general.tourCompleted)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const language = useAppStore((state) => state.settings.general.language)
  const [step, setStep] = useState(0)

  if (!booted || bootError || tourCompleted) return null

  const lang = language === 'en' ? 'en' : 'es'
  const t = (es: string, en: string): string => (lang === 'es' ? es : en)
  const finish = (): void =>
    updateSettings((draft) => {
      draft.general.tourCompleted = true
    })
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="tour-backdrop" role="dialog" aria-modal="true" aria-label={t('Tour de bienvenida', 'Welcome tour')}>
      <div className="tour-card">
        <button className="tour-skip" onClick={finish}>
          {t('Omitir', 'Skip')}
        </button>
        <div className="tour-emoji" aria-hidden="true">
          {current.emoji}
        </div>
        <h3>{current.title[lang]}</h3>
        <p>{current.text[lang]}</p>
        <div className="tour-footer">
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((_, index) => (
              <i key={index} className={index === step ? 'active' : ''} />
            ))}
          </div>
          <div className="tour-actions">
            {step > 0 && (
              <button className="btn ghost" onClick={() => setStep((value) => Math.max(0, value - 1))}>
                {t('Anterior', 'Back')}
              </button>
            )}
            {isLast ? (
              <button className="btn primary" onClick={finish}>
                {t('Empezar a escribir', 'Start writing')}
              </button>
            ) : (
              <button className="btn primary" onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}>
                {t('Siguiente', 'Next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
