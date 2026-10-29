import { useEffect, useState } from 'react'
import {
  ArchiveRestore,
  Check,
  BookOpen,
  Github,
  Cloud,
  Coffee,
  Database,
  Eye,
  EyeOff,
  Feather,
  HardDrive,
  Info,
  KeyRound,
  Laptop,
  Loader2,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Wifi
} from 'lucide-react'
import type { AccentColor, AiCategory, AiProtocol, AiProvider, ThemeMode } from '@shared/types'
import { LOCAL_PROVIDER_PRESETS } from '@shared/defaults'
import { useAppStore } from '../../store/useAppStore'
import { Modal, Switch } from '../ui/Modal'
import { AppIcon } from '../AppIcon'
import { UsageGuide } from '../help/UsageGuide'
import { GUIDE_GITHUB_URL, GUIDE_KOFI_URL } from '../help/guideContent'
import { Field } from '../ui/Form'

type SettingsTab = 'general' | 'editor' | 'ai' | 'backups' | 'about'

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof Palette }> = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'editor', label: 'Editor', icon: Type },
  { id: 'ai', label: 'Inteligencia artificial', icon: Sparkles },
  { id: 'backups', label: 'Copias y versiones', icon: Database },
  { id: 'about', label: 'Acerca de', icon: Info }
]

const ACCENT_COLORS: Array<{ id: AccentColor; label: string; color: string }> = [
  { id: 'amber', label: 'Ámbar', color: '#d7a667' },
  { id: 'rose', label: 'Rosa', color: '#d18782' },
  { id: 'sage', label: 'Salvia', color: '#93b494' },
  { id: 'ocean', label: 'Océano', color: '#82aacb' },
  { id: 'violet', label: 'Violeta', color: '#b39ed0' },
  { id: 'graphite', label: 'Grafito', color: '#a9a59c' }
]

const FONT_FAMILIES = [
  { id: 'serif' as const, label: 'Newsreader', family: "'Newsreader Variable', Georgia, serif" },
  { id: 'sans' as const, label: 'Manrope', family: "'Manrope Variable', sans-serif" },
  { id: 'mono' as const, label: 'JetBrains Mono', family: "'JetBrains Mono Variable', monospace" }
]

function makeProvider(presetIndex = 0): AiProvider {
  const preset = LOCAL_PROVIDER_PRESETS[presetIndex] || LOCAL_PROVIDER_PRESETS[0]
  return {
    ...preset,
    id: `provider_${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    apiKey: '',
    hasApiKey: false,
    clearApiKey: false
  }
}

function ProviderPanel({
  provider,
  onNotify
}: {
  provider: AiProvider
  onNotify: (message: string, tone: 'info' | 'success' | 'error') => void
}) {
  const replaceProvider = useAppStore((state) => state.replaceProvider)
  const removeProvider = useAppStore((state) => state.removeProvider)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const settings = useAppStore((state) => state.settings)
  const pushToast = useAppStore((state) => state.pushToast)
  const [testing, setTesting] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [showKey, setShowKey] = useState(false)

  const patch = (values: Partial<AiProvider>): void => {
    replaceProvider({ ...provider, ...values, clearApiKey: values.clearApiKey ?? provider.clearApiKey })
  }

  const test = async (): Promise<void> => {
    setTesting(true)
    try {
      const result = await window.novelcraft.testProvider(provider.id, provider)
      if (result.ok) {
        onNotify(result.message || 'Conexión correcta.', 'success')
        if (result.models?.length) setModels(result.models)
      } else {
        onNotify(result.message || 'No se pudo conectar.', 'error')
      }
    } catch (error) {
      onNotify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setTesting(false)
    }
  }

  const discover = async (): Promise<void> => {
    setModelsLoading(true)
    try {
      const result = await window.novelcraft.listModels(provider.id)
      setModels(result)
      if (!result.length) onNotify('El proveedor no devolvió modelos. Revisa la URL y la conexión.', 'info')
      else if (!result.includes(provider.model)) patch({ model: result[0] })
      else onNotify(`${result.length} modelos disponibles.`, 'success')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setModelsLoading(false)
    }
  }

  return (
    <div className="provider-editor">
      <div className="provider-editor-head">
        <div>
          <div className="card-eyebrow">{provider.category === 'local' ? 'Modelo local' : 'Servicio en la nube'}</div>
          <input
            className="provider-name-input"
            value={provider.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="Nombre del proveedor"
          />
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => void test()} disabled={testing}>
            {testing ? <Loader2 size={12} style={{ animation: 'spin 800ms linear infinite' }} /> : <Wifi size={12} />}
            Probar
          </button>
          <button
            className="icon-btn sm danger"
            title="Eliminar proveedor"
            onClick={() => {
              removeProvider(provider.id)
              onNotify('Proveedor eliminado.', 'info')
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="field-row">
        <Field label="Protocolo">
          <select className="select sm" value={provider.protocol} onChange={(event) => patch({ protocol: event.target.value as AiProtocol })}>
            <option value="openai">OpenAI compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
          </select>
        </Field>
        <Field label="Entorno">
          <select className="select sm" value={provider.category} onChange={(event) => patch({ category: event.target.value as AiCategory })}>
            <option value="local">Local</option>
            <option value="cloud">Nube</option>
          </select>
        </Field>
      </div>
      <Field label="URL base" className="mt-12">
        <input className="input sm mono" value={provider.baseUrl} onChange={(event) => patch({ baseUrl: event.target.value })} placeholder="http://localhost:11434" />
      </Field>
      <Field label="Modelo" className="mt-12">
        <div className="row">
          <input className="input sm mono grow" value={provider.model} onChange={(event) => patch({ model: event.target.value })} placeholder="llama3.2" />
          <button className="btn sm" onClick={() => void discover()} disabled={modelsLoading} title="Detectar modelos">
            {modelsLoading ? <Loader2 size={12} style={{ animation: 'spin 800ms linear infinite' }} /> : <RefreshCw size={12} />}
          </button>
        </div>
        {models.length > 0 && (
          <div className="model-chips">
            {models.slice(0, 16).map((model) => (
              <button
                key={model}
                className={`model-chip ${provider.model === model ? 'active' : ''}`}
                onClick={() => patch({ model })}
              >
                {model}
              </button>
            ))}
          </div>
        )}
      </Field>
      {provider.category === 'cloud' && (
        <Field label="Clave API" className="mt-12" hint={provider.hasApiKey ? 'Hay una clave cifrada guardada en este equipo.' : 'La clave se guarda cifrada y nunca sale de tu equipo salvo en las peticiones al proveedor.'}>
          <div className="key-input-wrap">
            <KeyRound size={13} />
            <input
              className="input sm mono"
              type={showKey ? 'text' : 'password'}
              value={provider.apiKey || ''}
              onChange={(event) => patch({ apiKey: event.target.value, clearApiKey: false })}
              placeholder={provider.hasApiKey ? 'Clave guardada · escribe para reemplazar' : 'sk-...'}
            />
            <button className="icon-btn sm" onClick={() => setShowKey(!showKey)} title={showKey ? 'Ocultar clave' : 'Mostrar clave'}>
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {provider.hasApiKey && (
            <button
              className="text-link mt-8"
              onClick={() => {
                patch({ apiKey: '', clearApiKey: true })
                onNotify('La clave se eliminará al guardar los ajustes.', 'info')
              }}
            >
              Eliminar clave guardada
            </button>
          )}
        </Field>
      )}
      <div className="field-row mt-12">
        <Field label={`Temperatura · ${provider.temperature.toFixed(2)}`}>
          <input
            className="range"
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={provider.temperature}
            onChange={(event) => patch({ temperature: Number(event.target.value) })}
          />
        </Field>
        <Field label="Máximo de tokens">
          <input
            className="input sm"
            type="number"
            min={128}
            max={32000}
            step={128}
            value={provider.maxTokens}
            onChange={(event) => patch({ maxTokens: Number(event.target.value) || 2048 })}
          />
        </Field>
      </div>
      <div className="provider-use-row">
        <div>
          <strong>Usar este proveedor</strong>
          <span>El asistente y las acciones de escritura usarán este modelo.</span>
        </div>
        <Switch
          checked={settings.ai.activeProviderId === provider.id}
          onChange={(checked) => {
            if (checked) updateSettings((draft) => { draft.ai.activeProviderId = provider.id })
          }}
        />
      </div>
      <div className="row mt-12">
        <button className="btn sm" onClick={() => void test()} disabled={testing}>
          {testing ? <Loader2 size={12} /> : <Check size={12} />}
          Verificar conexión
        </button>
      </div>
    </div>
  )
}

export function SettingsModal() {
  const open = useAppStore((state) => state.settingsOpen)
  const setOpen = useAppStore((state) => state.setSettingsOpen)
  const settings = useAppStore((state) => state.settings)
  const project = useAppStore((state) => state.project)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const saveSettingsNow = useAppStore((state) => state.saveSettingsNow)
  const settingsDirty = useAppStore((state) => state.settingsDirty)
  const appInfo = useAppStore((state) => state.appInfo)
  const setSnapshotsOpen = useAppStore((state) => state.setSnapshotsOpen)
  const setBackupManagerOpen = useAppStore((state) => state.setBackupManagerOpen)
  const setTrashOpen = useAppStore((state) => state.setTrashOpen)
  const [tab, setTab] = useState<SettingsTab>('general')
  const [guideOpen, setGuideOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState(settings.ai.activeProviderId)

  useEffect(() => {
    if (!open) return
    setSelectedProvider((current) =>
      settings.providers.some((provider) => provider.id === current)
        ? current
        : settings.ai.activeProviderId || settings.providers[0]?.id || ''
    )
  }, [open, settings.ai.activeProviderId, settings.providers])

  const selected = settings.providers.find((provider) => provider.id === selectedProvider)

  const saveNow = (): void => {
    void saveSettingsNow()
  }

  const addProvider = (): void => {
    const provider = makeProvider(settings.providers.length >= 4 ? 0 : 0)
    useAppStore.getState().replaceProvider(provider)
    setSelectedProvider(provider.id)
    useAppStore.getState().pushToast('Proveedor añadido. Configura sus datos.', 'info')
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      size="xl"
      className="settings-modal"
      eyebrow="NovelCraft"
      title="Ajustes"
      subtitle="Adapta el estudio a tu forma de escribir."
      closeOnBackdrop={!settingsDirty}
      footer={
        <>
          <span className="settings-save-state">
            {settingsDirty ? <><span className="save-dot pending" />Guardando cambios...</> : <><Check size={12} />Ajustes al día</>}
          </span>
          <span className="grow" />
          <button
            className="btn btn-primary"
            onClick={() => {
              if (settingsDirty) void saveNow()
              setOpen(false)
            }}
          >
            Listo
          </button>
        </>
      }
    >
      <div className="settings-layout">
        <nav className="settings-nav">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              <Icon size={14} />
              {label}
            </button>
          ))}
          <div className="settings-nav-footer">
            <span>v{appInfo?.version || '1.0.0'}</span>
          </div>
        </nav>

        <div className="settings-content">
          {tab === 'general' && (
            <div className="settings-pane">
              <div className="settings-pane-head">
                <h3>Apariencia y comportamiento</h3>
                <p>Elige cómo se siente NovelCraft en tu escritorio.</p>
              </div>
              <section className="settings-section">
                <div className="settings-section-title">Tema</div>
                <div className="theme-options">
                  {([
                    { id: 'dark' as ThemeMode, label: 'Oscuro', icon: Moon },
                    { id: 'sepia' as ThemeMode, label: 'Sepia', icon: Coffee },
                    { id: 'light' as ThemeMode, label: 'Claro', icon: Sun },
                    { id: 'system' as ThemeMode, label: 'Sistema', icon: Laptop }
                  ]).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      className={`theme-card ${settings.general.theme === id ? 'active' : ''}`}
                      onClick={() => updateSettings((draft) => { draft.general.theme = id })}
                    >
                      <span className={`theme-preview ${id}`}>
                        <i /><i /><i />
                      </span>
                      <span><Icon size={12} />{label}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="settings-section">
                <div className="settings-section-title">Color de énfasis</div>
                <div className="accent-options">
                  {ACCENT_COLORS.map(({ id, label, color }) => {
                    const active = settings.general.accentColor === id
                    return (
                      <button
                        key={id}
                        className={`accent-card ${active ? 'active' : ''}`}
                        onClick={() => updateSettings((draft) => { draft.general.accentColor = id })}
                        aria-label={`Color de énfasis ${label}`}
                        title={label}
                      >
                        <span className="accent-swatch" style={{ background: color }}>
                          {active && <Check size={12} />}
                        </span>
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
              <section className="settings-section">
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Tamaño de la interfaz</div>
                    <div className="setting-desc">Escala de todos los elementos de la app. El editor tiene además su propio tamaño de letra.</div>
                  </div>
                  <div className="settings-inline-control">
                    <select
                      className="select sm"
                      value={settings.general.uiScale}
                      onChange={(event) => updateSettings((draft) => { draft.general.uiScale = Number(event.target.value) || 100 })}
                    >
                      {[80, 90, 100, 110, 125, 150].map((pct) => (
                        <option key={pct} value={pct}>{pct}%</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Reabrir el último proyecto</div>
                    <div className="setting-desc">Al iniciar, continúa donde lo dejaste en lugar de mostrar la biblioteca.</div>
                  </div>
                  <Switch checked={settings.general.reopenLastProject} onChange={(value) => updateSettings((draft) => { draft.general.reopenLastProject = value })} />
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Mostrar contador de palabras</div>
                    <div className="setting-desc">Muestra el progreso y los recuentos en el editor y el árbol.</div>
                  </div>
                  <Switch checked={settings.general.showWordCount} onChange={(value) => updateSettings((draft) => { draft.general.showWordCount = value })} />
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Animaciones de interfaz</div>
                    <div className="setting-desc">Transiciones suaves y aparición progresiva de paneles.</div>
                  </div>
                  <Switch checked={settings.general.animations} onChange={(value) => updateSettings((draft) => { draft.general.animations = value })} />
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Guardado automático</div>
                    <div className="setting-desc">Cada cambio se guarda en el proyecto tras unos segundos de inactividad.</div>
                  </div>
                  <div className="settings-inline-control">
                    <input
                      className="input sm"
                      type="number"
                      min={1}
                      max={60}
                      value={settings.general.autosaveSeconds}
                      onChange={(event) => updateSettings((draft) => { draft.general.autosaveSeconds = Math.max(1, Number(event.target.value) || 2) })}
                    />
                    <span>seg</span>
                  </div>
                </div>
              </section>
              <section className="settings-section">
                <div className="settings-section-title">Idioma de la interfaz</div>
                <Field label="Idioma" hint="Los proyectos conservan su propio idioma literario.">
                  <select className="select" value={settings.general.language} onChange={(event) => updateSettings((draft) => { draft.general.language = event.target.value })}>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </Field>
              </section>
            </div>
          )}

          {tab === 'editor' && (
            <div className="settings-pane">
              <div className="settings-pane-head">
                <h3>Experiencia de escritura</h3>
                <p>Ajusta la página para que las palabras fluyan.</p>
              </div>
              <section className="settings-section">
                <div className="settings-section-title">Tipografía</div>
                <div className="font-options">
                  {FONT_FAMILIES.map((font) => (
                    <button
                      key={font.id}
                      className={`font-card ${settings.editor.fontFamily === font.id ? 'active' : ''}`}
                      onClick={() => updateSettings((draft) => { draft.editor.fontFamily = font.id })}
                      style={{ fontFamily: font.family }}
                    >
                      <span className="font-sample">Aa</span>
                      <span>{font.label}</span>
                    </button>
                  ))}
                </div>
                <div className="field-row mt-16">
                  <Field label={`Tamaño · ${settings.editor.fontSize}px`}>
                    <input className="range" type="range" min={14} max={28} step={1} value={settings.editor.fontSize} onChange={(event) => updateSettings((draft) => { draft.editor.fontSize = Number(event.target.value) })} />
                  </Field>
                  <Field label={`Altura de línea · ${settings.editor.lineHeight}`}>
                    <input className="range" type="range" min={1.4} max={2.2} step={0.05} value={settings.editor.lineHeight} onChange={(event) => updateSettings((draft) => { draft.editor.lineHeight = Number(event.target.value) })} />
                  </Field>
                </div>
                <Field label={`Ancho de página · ${settings.editor.maxWidth}px`} className="mt-16">
                  <input className="range" type="range" min={560} max={980} step={20} value={settings.editor.maxWidth} onChange={(event) => updateSettings((draft) => { draft.editor.maxWidth = Number(event.target.value) })} />
                </Field>
              </section>
              <section className="settings-section">
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Corrector ortográfico</div>
                    <div className="setting-desc">Subraya las palabras desconocidas mientras escribes.</div>
                  </div>
                  <Switch checked={settings.editor.spellcheck} onChange={(value) => updateSettings((draft) => { draft.editor.spellcheck = value })} />
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Atenuar el resto de la interfaz</div>
                    <div className="setting-desc">Reduce el ruido visual y enfoca la página en el modo concentración.</div>
                  </div>
                  <Switch checked={settings.editor.focusDim} onChange={(value) => updateSettings((draft) => { draft.editor.focusDim = value })} />
                </div>
              </section>
              <section className="settings-section">
                <div className="settings-section-title">Vista previa</div>
                <div className="editor-preview" style={{ fontFamily: FONT_FAMILIES.find((font) => font.id === settings.editor.fontFamily)?.family }}>
                  <div className="editor-preview-title">La página en blanco</div>
                  <p style={{ fontSize: settings.editor.fontSize, lineHeight: settings.editor.lineHeight }}>
                    Toda novela empieza con una respiración. La luz entraba oblicua por la ventana y el mundo, por un instante, parecía dispuesto a contarlo todo.
                  </p>
                </div>
              </section>
            </div>
          )}

          {tab === 'ai' && (
            <div className="settings-pane">
              <div className="settings-pane-head">
                <h3>Asistencia literaria</h3>
                <p>Conecta un modelo local o en la nube. La IA es opcional y siempre trabaja con tu contexto.</p>
              </div>
              <section className="settings-section">
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Activar inteligencia artificial</div>
                    <div className="setting-desc">Habilita el chat lateral y las acciones de escritura con IA.</div>
                  </div>
                  <Switch checked={settings.ai.enabled} onChange={(value) => updateSettings((draft) => { draft.ai.enabled = value })} />
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Acciones sobre la selección</div>
                    <div className="setting-desc">Muestra el menú flotante al seleccionar texto en el editor.</div>
                  </div>
                  <Switch checked={settings.ai.selectionActions} onChange={(value) => updateSettings((draft) => { draft.ai.selectionActions = value })} disabled={!settings.ai.enabled} />
                </div>
              </section>
              <section className="settings-section">
                <div className="settings-section-title">Contexto compartido con el modelo</div>
                <div className="context-toggle-grid">
                  {([
                    ['includeManuscript', 'Manuscrito', 'Estructura, títulos y resúmenes de escenas'],
                    ['includeCodex', 'Codex', 'Personajes, lugares e ítems'],
                    ['includePlots', 'Tramas', 'Líneas argumentales y relaciones'],
                    ['includeSceneContent', 'Texto de escenas', 'Incluye el contenido completo de la escena activa']
                  ] as const).map(([key, label, description]) => (
                    <button
                      key={key}
                      className={`context-toggle ${settings.ai[key] ? 'active' : ''}`}
                      onClick={() => updateSettings((draft) => { draft.ai[key] = !draft.ai[key] })}
                    >
                      <span className="context-toggle-check">{settings.ai[key] && <Check size={11} />}</span>
                      <span><strong>{label}</strong><small>{description}</small></span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="settings-section ai-providers-section">
                <div className="settings-section-title-row">
                  <div className="settings-section-title">Proveedores</div>
                  <button className="btn sm" onClick={addProvider}><Plus size={12} />Añadir</button>
                </div>
                <div className="provider-layout">
                  <div className="provider-list">
                    {settings.providers.map((provider) => (
                      <button
                        key={provider.id}
                        className={`provider-list-item ${selectedProvider === provider.id ? 'active' : ''}`}
                        onClick={() => setSelectedProvider(provider.id)}
                      >
                        <span className={`provider-list-icon ${provider.category}`}>
                          {provider.category === 'local' ? <HardDrive size={14} /> : <Cloud size={14} />}
                        </span>
                        <span className="grow">
                          <strong>{provider.name}</strong>
                          <small>{provider.model || 'Sin modelo'}</small>
                        </span>
                        {settings.ai.activeProviderId === provider.id && <span className="provider-active-mark"><Check size={10} />activo</span>}
                      </button>
                    ))}
                  </div>
                  <div className="provider-detail">
                    {selected ? (
                      <ProviderPanel provider={selected} onNotify={(message, tone) => useAppStore.getState().pushToast(message, tone)} />
                    ) : (
                      <div className="provider-empty">Añade un proveedor para configurar la IA.</div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'backups' && (
            <div className="settings-pane">
              <div className="settings-pane-head">
                <h3>Seguridad de tu obra</h3>
                <p>NovelCraft guarda versiones automáticas de cada escena y copias completas del proyecto.</p>
              </div>
              <section className="settings-section">
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Historial de versiones por documento</div>
                    <div className="setting-desc">Guarda una instantánea cada vez que cambia una escena.</div>
                  </div>
                  <Switch checked={settings.backups.snapshotsEnabled} onChange={(value) => updateSettings((draft) => { draft.backups.snapshotsEnabled = value })} />
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Versiones por documento</div>
                    <div className="setting-desc">Las versiones más antiguas se eliminan al superar este límite.</div>
                  </div>
                  <div className="settings-inline-control">
                    <input className="input sm" type="number" min={5} max={500} value={settings.backups.snapshotLimit} onChange={(event) => updateSettings((draft) => { draft.backups.snapshotLimit = Math.max(5, Number(event.target.value) || 40) })} />
                    <span>versiones</span>
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Copia de seguridad automática</div>
                    <div className="setting-desc">Crea un ZIP completo del proyecto mientras trabajas.</div>
                  </div>
                  <div className="settings-inline-control">
                    <input className="input sm" type="number" min={5} max={240} step={5} value={settings.backups.autoBackupMinutes} onChange={(event) => updateSettings((draft) => { draft.backups.autoBackupMinutes = Math.max(5, Number(event.target.value) || 30) })} />
                    <span>min</span>
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Copias conservadas</div>
                    <div className="setting-desc">Número máximo de archivos ZIP que se mantienen por proyecto.</div>
                  </div>
                  <div className="settings-inline-control">
                    <input className="input sm" type="number" min={3} max={100} value={settings.backups.backupLimit} onChange={(event) => updateSettings((draft) => { draft.backups.backupLimit = Math.max(3, Number(event.target.value) || 20) })} />
                    <span>copias</span>
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Copia al cerrar la aplicación</div>
                    <div className="setting-desc">Se crea una copia de seguridad antes de salir, si ha pasado suficiente tiempo.</div>
                  </div>
                  <Switch checked={settings.backups.backupOnExit} onChange={(value) => updateSettings((draft) => { draft.backups.backupOnExit = value })} />
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-title">Retención de la papelera</div>
                    <div className="setting-desc">Los documentos eliminados se conservan este tiempo. Usa 0 para no borrarlos automáticamente.</div>
                  </div>
                  <div className="settings-inline-control">
                    <input className="input sm" type="number" min={0} max={3650} value={settings.backups.trashRetentionDays} onChange={(event) => updateSettings((draft) => { draft.backups.trashRetentionDays = Math.max(0, Number(event.target.value) || 0) })} />
                    <span>días</span>
                  </div>
                </div>
              </section>
              <section className="settings-section">
                <div className="backup-action-row">
                  <div>
                    <ArchiveRestore size={17} />
                    <span><strong>Versiones de la escena activa</strong><small>Compara y recupera textos anteriores.</small></span>
                  </div>
                  <button className="btn sm" disabled={!project} onClick={() => setSnapshotsOpen(true)}>Abrir historial</button>
                </div>
                <div className="backup-action-row">
                  <div>
                    <Database size={17} />
                    <span><strong>Copias del proyecto</strong><small>Crea, restaura o exporta copias completas.</small></span>
                  </div>
                  <button className="btn sm" disabled={!project} onClick={() => setBackupManagerOpen(true)}>Gestionar copias</button>
                </div>
                <div className="backup-action-row">
                  <div>
                    <Trash2 size={17} />
                    <span><strong>Papelera</strong><small>{project?.trash.length || 0} documentos · {settings.backups.trashRetentionDays > 0 ? `${settings.backups.trashRetentionDays} días de retención` : 'retención indefinida'}</small></span>
                  </div>
                  <button className="btn sm" disabled={!project} onClick={() => { setOpen(false); setTrashOpen(true) }}>Abrir papelera</button>
                </div>
                {appInfo?.dataPath && (
                  <div className="data-path"><HardDrive size={12} /><span>{appInfo.dataPath}</span></div>
                )}
              </section>
              <div className="settings-note">
                <Feather size={14} />
                <p>Los backups se almacenan dentro de la carpeta del proyecto. Puedes exportarlos y llevarlos contigo a otro equipo.</p>
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="settings-pane">
              <div className="about-hero">
                <AppIcon className="brand-mark about-mark" />
                <h3>NovelCraft</h3>
                <p>Un estudio literario completo para planificar, escribir y publicar novelas.</p>
                <span className="chip">Versión {appInfo?.version || '1.0.0'}</span>
                <div className="about-author">
                  <span className="about-author-label">Autoría</span>
                  <span className="about-author-name">NULLUSNULL</span>
                  <div className="about-links">
                    <button className="btn ghost" onClick={() => window.novelcraft.openExternal(GUIDE_GITHUB_URL)}>
                      <Github size={13} />
                      GitHub
                    </button>
                    <button className="btn kofi-btn" onClick={() => window.novelcraft.openExternal(GUIDE_KOFI_URL)}>
                      <Coffee size={13} />
                      Donar en Ko-fi
                    </button>
                    <button className="btn primary" onClick={() => setGuideOpen(true)}>
                      <BookOpen size={13} />
                      Guía de uso
                    </button>
                  </div>
                </div>
              </div>
              <section className="settings-section about-specs">
                <div><span>Electron</span><strong>{appInfo?.electron || '—'}</strong></div>
                <div><span>Chromium</span><strong>{appInfo?.chrome || '—'}</strong></div>
                <div><span>Plataforma</span><strong>{appInfo?.platform || '—'}</strong></div>
                <div><span>Datos</span><strong className="mono truncate">{appInfo?.dataPath || '—'}</strong></div>
              </section>
              <section className="settings-section">
                <div className="settings-section-title">Filosofía</div>
                <p className="about-text">
                  NovelCraft nace de una idea sencilla: tu manuscrito pertenece a tu disco y a nadie más. Todo el proyecto se guarda en archivos abiertos y portables. La inteligencia artificial es una herramienta opcional, nunca el centro del proceso creativo.
                </p>
              </section>
              <section className="settings-section">
                <div className="settings-section-title">Atajos esenciales</div>
                <div className="shortcut-grid">
                  <div><kbd>Ctrl K</kbd><span>Paleta de comandos</span></div>
                  <div><kbd>Ctrl S</kbd><span>Guardar</span></div>
                  <div><kbd>Ctrl ,</kbd><span>Ajustes</span></div>
                  <div><kbd>Ctrl ⇧ F</kbd><span>Modo concentración</span></div>
                  <div><kbd>Ctrl ⇧ A</kbd><span>Asistente IA</span></div>
                  <div><kbd>Alt 1-4</kbd><span>Cambiar de vista</span></div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
      <UsageGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </Modal>
  )
}
