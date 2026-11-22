import { useAppStore } from '../../store/useAppStore'
import { useEffect } from 'react'
import { BookOpen, Feather, Palette, PenTool } from 'lucide-react'

interface WritingGuideCategory {
  id: string
  title: string
  description: string
}

const GUIDE_CATEGORIES: WritingGuideCategory[] = [
  {
    id: 'character',
    title: 'Desarrollo de Personajes',
    description: 'Crear personajes memorables y tridimensionales con motivaciones claras',
  },
  {
    id: 'plot',
    title: 'Estructura de Trama',
    description: 'Construir tramas envolventes con giros inesperados',
  },
  {
    id: 'dialogue',
    title: 'Diálogos Naturales',
    description: 'Escribir diálogos que suonen auténticos y avancen la historia',
  },
  {
    id: 'setting',
    title: 'Ambientación',
    description: 'Crear mundos vívidos que sumerjan al lector',
  },
  {
    id: 'theme',
    title: 'Temas y Motivos',
    description: 'Desarrollar temas profundos que den resonancia a tu historia',
  },
]

function getIcon(categoryId: string) {
  switch (categoryId) {
    case 'character':
      return <BookOpen size={24} />
    case 'plot':
      return <BookOpen size={24} />
    case 'dialogue':
      return <Palette size={24} />
    case 'setting':
      return <Feather size={24} />
    case 'theme':
      return <PenTool size={24} />
    default:
      return <BookOpen size={24} />
  }
}

export function WritingGuideView() {
  const setView = useAppStore((state) => state.setView)

  useEffect(() => {
    // Ensure we start on the write view when guide is closed
    return () => {
      // No need to set view on unmount
    }
  }, [])

  return (
    <div className="writing-guide-view min-h-screen p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Guía de Escritura</h1>
        <p className="text-muted">Recursos y consejos para mejorar tu narrativa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {GUIDE_CATEGORIES.map((category) => (
          <div
            key={category.id}
            className="group rounded-lg border p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setView('write')}
          >
            <div className="h-12 flex items-center justify-center rounded-lg mb-3">
              {getIcon(category.id)}
            </div>
            <h3 className="font-medium">{category.title}</h3>
            <p className="text-sm text-muted line-clamp-2">{category.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}