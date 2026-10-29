import appIcon from '../assets/app-icon.png'

export function AppIcon({ className }: { className: string }) {
  return <img className={className} src={appIcon} alt="NovelCraft" draggable={false} />
}
