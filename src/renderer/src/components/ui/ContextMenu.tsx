import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'

export interface ContextMenuItem {
  id: string
  label?: string
  icon?: ReactNode
  shortcut?: string
  danger?: boolean
  divider?: boolean
  heading?: boolean
  disabled?: boolean
  action?: () => void
  children?: ContextMenuItem[]
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [submenu, setSubmenu] = useState<{ id: string; left: boolean } | null>(null)

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    const handleBlur = (): void => onClose()
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('blur', handleBlur)
    }
  }, [onClose])

  const style = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - Math.max(120, items.length * 31 + 20))
  }

  const openSubmenu = (item: ContextMenuItem, element: HTMLDivElement): void => {
    if (!item.children?.length) return
    const rect = element.getBoundingClientRect()
    setSubmenu({ id: item.id, left: rect.right + 210 > window.innerWidth })
  }

  const renderItems = (list: ContextMenuItem[]): ReactNode =>
    list.map((item, index) => {
      if (item.divider) return <div className="context-sep" key={item.id} />
      if (item.heading)
        return (
          <div className="context-label" key={item.id}>
            {item.label}
          </div>
        )
      if (item.children?.length) {
        const isOpen = submenu?.id === item.id
        return (
          <div
            className="context-submenu-wrap"
            key={`${item.id}_${index}`}
            onMouseEnter={(event) => openSubmenu(item, event.currentTarget)}
            onMouseLeave={() => setSubmenu(null)}
          >
            <button
              className="context-item context-parent"
              disabled={item.disabled}
              onClick={() => {
                const rect = ref.current?.getBoundingClientRect()
                setSubmenu(isOpen ? null : { id: item.id, left: Boolean(rect && rect.right + 210 > window.innerWidth) })
              }}
            >
              {item.icon}
              <span>{item.label}</span>
              <ChevronRight size={13} className="context-chevron" />
            </button>
            {isOpen && (
              <div className={`context-submenu ${submenu?.left ? 'left' : ''}`}>
                {item.children.map((child) => {
                  if (child.divider) return <div className="context-sep" key={child.id} />
                  if (child.heading)
                    return (
                      <div className="context-label" key={child.id}>
                        {child.label}
                      </div>
                    )
                  return (
                    <button
                      className={`context-item ${child.danger ? 'danger' : ''}`}
                      key={child.id}
                      disabled={child.disabled}
                      onClick={() => {
                        child.action?.()
                        onClose()
                      }}
                    >
                      {child.icon}
                      <span>{child.label}</span>
                      {child.shortcut && <span className="kbd">{child.shortcut}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      }
      return (
        <button
          className={`context-item ${item.danger ? 'danger' : ''}`}
          key={`${item.id}_${index}`}
          disabled={item.disabled}
          onClick={() => {
            item.action?.()
            onClose()
          }}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.shortcut && <span className="kbd">{item.shortcut}</span>}
        </button>
      )
    })

  return createPortal(
    <div ref={ref} className="context-menu" style={style} onContextMenu={(event) => event.preventDefault()}>
      {renderItems(items)}
    </div>,
    document.body
  )
}
