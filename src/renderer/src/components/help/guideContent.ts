export type GuideLang = 'es' | 'en'

export interface GuideSection {
  id: string
  icon: string
  title: { es: string; en: string }
  body: { es: string[]; en: string[] }
  tips: { es: string[]; en: string[] }
}

export const GUIDE_AUTHORS = ['NULLUSNULL']
export const GUIDE_GITHUB_URL = 'https://github.com/NULLUSNULL/NovelCraft'
export const GUIDE_KOFI_URL = 'https://ko-fi.com/nullusnull'

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'welcome',
    icon: 'feather',
    title: { es: 'Bienvenido a NovelCraft', en: 'Welcome to NovelCraft' },
    body: {
      es: [
        'NovelCraft es un estudio literario completo para planificar, escribir y publicar novelas. Reúne en una sola aplicación el manuscrito, la biblia de la historia (códex), el tablero de tramas y las herramientas de exportación.',
        'Tus datos son tuyos: cada proyecto se guarda como archivos abiertos dentro de tu carpeta de documentos (NovelCraft), sin cuenta, sin nube obligatoria y sin formatos propietarios. Puedes copiar un proyecto a otro equipo simplemente moviendo su carpeta.',
        'La inteligencia artificial es opcional y configurable: puedes trabajar con modelos locales (Ollama, LM Studio) sin enviar nada a internet, o conectar proveedores en la nube si lo prefieres.'
      ],
      en: [
        'NovelCraft is a complete literary studio for planning, writing and publishing novels. It brings together your manuscript, your story bible (codex), the plot board and the export tools in a single application.',
        'Your data is yours: every project is stored as open files inside your documents folder (NovelCraft), with no account, no forced cloud and no proprietary formats. You can move a project to another computer just by copying its folder.',
        'Artificial intelligence is optional and configurable: work with local models (Ollama, LM Studio) without sending anything to the internet, or connect cloud providers if you prefer.'
      ]
    },
    tips: {
      es: [
        'Nada se pierde: la app guarda automáticamente cada cambio y crea instantáneas del historial de cada escena.',
        'Si algún día quieres cambiar de herramienta, exporta el manuscrito completo en Markdown, HTML, TXT, PDF o EPUB.'
      ],
      en: [
        'Nothing is lost: the app auto-saves every change and keeps snapshots of each scene history.',
        'If you ever switch tools, export the full manuscript to Markdown, HTML, TXT, PDF or EPUB.'
      ]
    }
  },
  {
    id: 'library',
    icon: 'library',
    title: { es: 'Biblioteca y proyectos', en: 'Library and projects' },
    body: {
      es: [
        'La biblioteca es la primera pantalla: cada tarjeta es una novela con su portada, autor, género, recuento de palabras y barra de progreso hacia el objetivo.',
        'Crear es inmediato con "Nuevo proyecto": título, autor/a, género, sinopsis, color de portada y objetivo de palabras (80.000 por defecto). También puedes generar un "Proyecto de ejemplo" para explorar la app con datos ya rellenos.',
        '"Importar" recupera un proyecto desde un archivo .novelcraft (copia portable). "Exportar" genera ese mismo archivo para llevar la novela a otro equipo o hacer una copia externa.',
        'El menú de cada tarjeta (tres puntos) permite abrir, exportar, mostrar la carpeta del proyecto en el explorador de archivos o eliminarlo. Lo eliminado pasa a la papelera, desde donde puedes restaurarlo.'
      ],
      en: [
        'The library is the first screen: each card is a novel with its cover, author, genre, word count and progress bar towards the goal.',
        'Creating is instant with "New project": title, author, genre, synopsis, cover color and word goal (80,000 by default). You can also generate a "Sample project" to explore the app with pre-filled data.',
        '"Import" recovers a project from a .novelcraft file (portable copy). "Export" generates that same file to carry the novel to another machine or keep an external copy.',
        'The card menu (three dots) lets you open, export, reveal the project folder in your file explorer or delete it. Deleted projects go to the trash, from which you can restore them.'
      ]
    },
    tips: {
      es: [
        'La portada de la tarjeta acepta una imagen propia: pásate por el formulario del proyecto y súbela.',
        '"Mostrar carpeta" es la forma más rápida de llegar a tus backups: se guardan dentro de la carpeta del proyecto.'
      ],
      en: [
        'The card cover accepts your own image: open the project form and upload it.',
        '"Reveal folder" is the fastest way to reach your backups: they are stored inside the project folder.'
      ]
    }
  },
  {
    id: 'workspace',
    icon: 'layout',
    title: { es: 'El espacio de trabajo', en: 'The workspace' },
    body: {
      es: [
        'Dentro de un proyecto, la ventana se organiza en cuatro zonas: la barra lateral izquierda (rail) cambia de vista; el árbol de documentos enumera capítulos, escenas y notas; el centro es el editor; y el panel derecho (inspector) muestra los detalles de lo seleccionado.',
        'Las vistas del rail son: Escribir (manuscrito y panel general), Códex (personajes, lugares y objetos), Tramas (tablero narrativo) y Publicar (exportación). También puedes saltar con Alt + 1 a 4.',
        'La barra de título central tiene la paleta de comandos (Ctrl + K o clic en "Buscar o ejecutar un comando"), desde la que puedes lanzar cualquier acción escribiendo unas letras: abrir proyectos, crear escenas, cambiar de vista, ajustes, etc.',
        'El modo concentración (Ctrl + Shift + F) oculta paneles laterales para escribir sin distracciones; repite el atajo para volver.'
      ],
      en: [
        'Inside a project, the window is organised in four areas: the left rail switches views; the document tree lists chapters, scenes and notes; the center is the editor; and the right panel (inspector) shows the details of whatever is selected.',
        'The rail views are: Write (manuscript and overview panel), Codex (characters, locations and items), Plots (story board) and Publish (export). You can also jump with Alt + 1 to 4.',
        'The center of the title bar holds the command palette (Ctrl + K or click "Search or run a command"), from which you can trigger any action by typing a few letters: open projects, create scenes, switch views, settings, etc.',
        'Focus mode (Ctrl + Shift + F) hides the side panels so you can write without distractions; press the shortcut again to come back.'
      ]
    },
    tips: {
      es: [
        'Si cierras un panel por error, la paleta de comandos (Ctrl + K) lo vuelve a abrir en un segundo.',
        'El inspector se abre automáticamente en la pestaña adecuada según lo que selecciones: escena, personaje o trama.'
      ],
      en: [
        'If you close a panel by mistake, the command palette (Ctrl + K) brings it back in a second.',
        'The inspector opens on the right tab depending on your selection: scene, character or plot.'
      ]
    }
  },
  {
    id: 'editor',
    icon: 'pen',
    title: { es: 'Editor de manuscrito', en: 'Manuscript editor' },
    body: {
      es: [
        'El editor es un procesador de textos de formato enriquecido. Su barra superior agrupa: deshacer/rehacer; el tipo de bloque (párrafo, título 1-3); negrita, cursiva, subrayado, tachado, código y resaltado con selector de color; listas con viñetas y numeradas, citas y separadores; alineación a izquierda, centro, derecha y justificada; y enlaces con borrado de formato.',
        'Al seleccionar texto aparece un menú flotante con las opciones más usadas, y con el clic derecho sobre el papel se abre un menú contextual con formato y acciones de IA sobre la selección.',
        'Cada escena guarda su propio objetivo de palabras y metadatos: punto de vista (personaje del códex), lugar, personajes que intervienen, objetos que aparecen, estado (idea, esquema, borrador, revisado, final), fecha y hora en la historia, etiquetas y notas de goal/conflicto/desénlace.',
        'El autoguardado escontinuo: los cambios se guardan solos tras unos segundos de inactividad (configurable en Ajustes) y también con Ctrl + S. El estado de guardado se ve junto al título del proyecto en la barra superior.',
        'Ajustes del editor: fuente serif, sans o monoespaciada, tamaño de letra, interlineado, ancho máximo de página, corrector ortográfico y atenuación del resto de la interfaz mientras escribes.'
      ],
      en: [
        'The editor is a rich-text word processor. Its top toolbar groups: undo/redo; block type (paragraph, heading 1-3); bold, italic, underline, strike, inline code and highlight with a color picker; bullet and numbered lists, quotes and horizontal rules; left, center, right and justified alignment; and links plus clear formatting.',
        'Selecting text shows a floating menu with the most used options, and right-clicking the paper opens a context menu with formatting and AI actions over the selection.',
        'Every scene stores its own word goal and metadata: point of view (a codex character), location, characters involved, items present, status (idea, outline, draft, revised, final), in-story date and time, tags and goal/conflict/outcome notes.',
        'Saving is continuous: changes are stored automatically after a few idle seconds (configurable in Settings) and also with Ctrl + S. The saving state appears next to the project title in the title bar.',
        'Editor settings: serif, sans or mono font, font size, line height, page width, spellcheck and dimming of the rest of the interface while writing.'
      ]
    },
    tips: {
      es: [
        'Antes de una reescritura grande, crea una instantánea de la escena (panel Historial): podrás volver al texto anterior en un clic.',
        'Rellena el "conflicto" de cada escena aunque sea en una línea: al planificar verás el arco completo de golpe.'
      ],
      en: [
        'Before a big rewrite, take a snapshot of the scene (History panel): you can return to the previous text in one click.',
        'Fill in each scene "conflict" even in one line: when planning you will see the whole arc at a glance.'
      ]
    }
  },
  {
    id: 'codex',
    icon: 'users',
    title: { es: 'Códex: personajes, lugares y objetos', en: 'Codex: characters, locations and items' },
    body: {
      es: [
        'El códex es la biblia de tu historia. En Personajes registrarás nombre, rol, edad, pronombres, ocupación, apariencia, personalidad, motivación, objetivo, conflicto, trasfondo, arco, secretos, voz y relaciones con otros personajes, además de un color y etiquetas propias.',
        'En Lugares documentas tipo, descripción, atmósfera, historia e importancia narrativa; en Objetos, su origen, significado y el personaje que lo porta actualmente. Cada ficha admite imagen y color.',
        'La magia está en el enlace con las escenas: al asignar punto de vista, lugar, personajes u objetos en el inspector de una escena, la ficha correspondiente muestra en qué capítulos aparece, y al revés.',
        'Las etiquetas de cada ficha permiten filtrar y agrupar: por ejemplo "protagonista", "antagonista", "act 2" o "revisar".'
      ],
      en: [
        'The codex is your story bible. In Characters you record name, role, age, pronouns, occupation, appearance, personality, motivation, goal, conflict, backstory, arc, secrets, voice and relationships with other characters, plus a color and tags.',
        'In Locations you document type, description, atmosphere, history and narrative significance; in Items, their origin, meaning and the character currently holding them. Every card supports an image and color.',
        'The magic is in the scene link: assigning point of view, location, characters or items in a scene inspector makes the corresponding card show which chapters it appears in, and the other way around.',
        'Tags on every card allow filtering and grouping: e.g. "protagonist", "antagonist", "act 2" or "needs review".'
      ]
    },
    tips: {
      es: [
        'Usa las relaciones entre personajes para detectar secretos cruzados antes de que se te oliden.',
        'El color de cada personaje aparece en el tablero de tramas y en las escenas: un vistazo te dice quién domina el capítulo.'
      ],
      en: [
        'Use character relationships to spot crossed secrets before you forget them.',
        'Each character color appears on the plot board and scenes: one glance tells you who owns the chapter.'
      ]
    }
  },
  {
    id: 'plots',
    icon: 'gitbranch',
    title: { es: 'Tramas y tablero narrativo', en: 'Plots and story board' },
    body: {
      es: [
        'La vista Tramas es un tablero visual con tarjetas arrastrables. Cada trama declara tipo (principal, secundaria, romance, misterio, conflicto o tema), estado (latente, activa, resuelta, abandonada), premisa, conflicto, apuestas, tema, resolución y un rango temporal en la historia.',
        'Las conexiones entre tramas se dibujan como líneas con etiqueta: causa, conflicto, convergencia o contrapunto. Así modelas por qué una subtrama dispara otra, o dónde se cruzan.',
        'Cada trama puede enlazar escenas del manuscrito y personajes del códex, de modo que el tablero refleja qué capítulos desarrollan cada hilo narrativo.'
      ],
      en: [
        'The Plots view is a visual board with draggable cards. Each plot declares a type (main, secondary, romance, mystery, conflict or theme), status (latent, active, resolved, abandoned), premise, conflict, stakes, theme, resolution and an in-story time range.',
        'Connections between plots are drawn as labelled lines: cause, conflict, convergence or counterpoint. That is how you model why one subplot triggers another, or where they cross.',
        'Every plot can link manuscript scenes and codex characters, so the board reflects which chapters develop each story thread.'
      ]
    },
    tips: {
      es: [
        'Marca el estado de cada trama al terminar una sesión: el tablero se convierte en tu mapa de lo que queda pendiente.',
        'Une la trama principal con cada subtrama mediante "convergencia" en el punto donde se encuentran: ayuda a ver el clímax.'
      ],
      en: [
        'Update each plot status after every session: the board becomes your map of pending work.',
        'Link the main plot with each subplot through "convergence" where they meet: it helps you see the climax.'
      ]
    }
  },
  {
    id: 'ai',
    icon: 'sparkles',
    title: { es: 'Asistente de IA (local o en la nube)', en: 'AI assistant (local or cloud)' },
    body: {
      es: [
        'En Ajustes → IA activas el asistente y eliges el proveedor activo. La app trae preconfigurados Ollama y LM Studio (modelos locales, nada sale de tu equipo) y OpenAI y Anthropic (nube, requieren su clave API).',
        'Para cada proveedor defines la URL base, el modelo, la temperatura y el límite de tokens; los botones "Probar" y "Modelos" verifican la conexión y traen la lista de modelos disponibles del servidor.',
        'Con la IA activada, la selección de texto ofrece acciones contextuales (mejorar, continuar, resumir...) desde el menú flotante o el clic derecho, y Ctrl + Shift + A abre el asistente sobre la escena actual.',
        'En Ajustes decides qué contexto ve el modelo: incluir el manuscrito completo, el códex, las tramas o solo el contenido de la escena. Más contexto = respuestas más finas, pero más consumo de tokens.'
      ],
      en: [
        'In Settings → AI you enable the assistant and pick the active provider. The app ships with Ollama and LM Studio (local models, nothing leaves your machine) and OpenAI and Anthropic (cloud, requiring their API key) preconfigured.',
        'For each provider you set the base URL, model, temperature and token limit; the "Test" and "Models" buttons check the connection and fetch the list of models the server exposes.',
        'With AI enabled, text selection offers contextual actions (improve, continue, summarize...) from the floating menu or right-click, and Ctrl + Shift + A opens the assistant over the current scene.',
        'In Settings you decide what context the model sees: include the full manuscript, the codex, the plots or only the scene content. More context = finer answers, but more token usage.'
      ]
    },
    tips: {
      es: [
        'Para escribir sin depender de internet, instala Ollama y descarga un modelo de instrucciones (por ejemplo llama3.2).',
        'Si un proveedor en la nube falla, revisa que la clave esté guardada y que la URL base termine en /v1 en los compatibles con OpenAI.'
      ],
      en: [
        'To write without depending on the internet, install Ollama and pull an instruct model (e.g. llama3.2).',
        'If a cloud provider fails, check the key is saved and that the base URL ends in /v1 on OpenAI-compatible servers.'
      ]
    }
  },
  {
    id: 'history',
    icon: 'history',
    title: { es: 'Historial, copias de seguridad y papelera', en: 'History, backups and trash' },
    body: {
      es: [
        'Cada escena tiene su historial de instantáneas: crea una manualmente cuando vayas a intervenir el texto con fuerza, y restaura o borra las que quieras desde el panel Historial.',
        'Las copias de seguridad completas se gestionan por proyecto: "Crear copia" genera un ZIP con todo, y la lista permite restaurar o borrar cada una. La app además crea copias automáticas periódicas y opcionalmente una al salir (configurable en Ajustes → Copias).',
        'Los documentos eliminados no desaparecen: van a la papelera del proyecto, donde puedes restaurarlos o vaciarla. El ajuste de retención limpia automáticamente lo antiguo.'
      ],
      en: [
        'Every scene has its snapshot history: take one manually whenever you are about to rewrite heavily, then restore or delete snapshots from the History panel.',
        'Full backups are managed per project: "Create backup" zips everything, and the list lets you restore or delete each one. The app also creates periodic automatic backups and optionally one on exit (configurable in Settings → Backups).',
        'Deleted documents do not vanish: they go to the project trash, where you can restore them or empty it. The retention setting cleans old entries automatically.'
      ]
    },
    tips: {
      es: [
        'Las copias viven dentro de la carpeta del proyecto: al exportar el .novelcraft viajan con él.',
        'Activa "copia al salir" si quieres una red de seguridad diaria sin acordarte.'
      ],
      en: [
        'Backups live inside the project folder: exporting the .novelcraft file carries them along.',
        'Enable "backup on exit" for a daily safety net you never have to think about.'
      ]
    }
  },
  {
    id: 'publish',
    icon: 'book',
    title: { es: 'Publicar y exportar', en: 'Publish and export' },
    body: {
      es: [
        'La vista Publicar convierte el manuscrito en un archivo listo para leer, imprimir o distribuir: PDF, HTML, Markdown, TXT o EPUB.',
        'Para el EPUB puedes incluir portada (imagen del proyecto) y página de título con autor/a, género y sinopsis; el idioma del libro se toma del propio proyecto.',
        'La exportación respeta la estructura del árbol: cada capítulo y escena se convierte en secciones del libro final.'
      ],
      en: [
        'The Publish view turns the manuscript into a file ready to read, print or distribute: PDF, HTML, Markdown, TXT or EPUB.',
        'For EPUB you can include a cover (the project image) and a title page with author, genre and synopsis; the book language comes from the project itself.',
        'Exporting respects the tree structure: every chapter and scene becomes a section of the final book.'
      ]
    },
    tips: {
      es: [
        'Exporta a Markdown para versionar tu novela en Git o llevarla a otra herramienta.',
        'El EPUB resultante se abre en lectores como Calibre o se sube directamente a tiendas digitales.'
      ],
      en: [
        'Export to Markdown to version your novel in Git or take it to another tool.',
        'The resulting EPUB opens in readers like Calibre or uploads straight to digital stores.'
      ]
    }
  },
  {
    id: 'settings',
    icon: 'sliders',
    title: { es: 'Ajustes de apariencia y comportamiento', en: 'Appearance and behaviour settings' },
    body: {
      es: [
        'Ajustes (Ctrl + , o el botón del rail) se organiza en pestañas. En General eliges tema (oscuro, sepia, claro o sistema), color de énfasis, tamaño de la interfaz en porcentaje (80-150 %), si se reabre el último proyecto, el contador de palabras, las animaciones, los segundos de autoguardado y el idioma de la interfaz.',
        'En Editor defines la experiencia de escritorio: fuente, tamaño, interlineado y ancho del papel, corrector y atenuación en modo concentración.',
        'Las pestañas de IA, Copias y Proveedores cubren el asistente, las copias de seguridad y la lista de proveedores con sus claves guardadas cifradas en el sistema.',
        'Todos los cambios se aplican al instante y se guardan solos; no hace falta ningún botón de guardar.'
      ],
      en: [
        'Settings (Ctrl + , or the rail button) is organised in tabs. Under General you pick the theme (dark, sepia, light or system), accent color, interface size in percent (80-150 %), whether to reopen the last project, the word counter, animations, autosave seconds and the interface language.',
        'Under Editor you shape the writing experience: font, size, line height and paper width, spellcheck and dimming in focus mode.',
        'The AI, Backups and Providers tabs cover the assistant, backups and the provider list with keys stored encrypted by the system.',
        'Every change applies at once and saves itself; there is no save button to press.'
      ]
    },
    tips: {
      es: [
        'Si las letras te quedan pequeñas, sube el "Tamaño de la interfaz" al 110 % o 125 %: escala toda la app de una vez.',
        'El tema "Sistema" sigue automáticamente al modo claro u oscuro de tu sistema operativo.'
      ],
      en: [
        'If text feels small, raise "Interface size" to 110 % or 125 %: it scales the whole app at once.',
        'The "System" theme follows your operating system light or dark mode automatically.'
      ]
    }
  },
  {
    id: 'shortcuts',
    icon: 'keyboard',
    title: { es: 'Atajos de teclado', en: 'Keyboard shortcuts' },
    body: {
      es: [
        'Ctrl + K abre la paleta de comandos; Ctrl + S guarda de inmediato; Ctrl + , abre Ajustes; Ctrl + Shift + F alterna el modo concentración; Ctrl + Shift + A abre el asistente de IA; Alt + 1 a 4 saltan entre vistas (Escribir, Códex, Tramas, Publicar); Escape cierra cualquier modal o panel abierto.',
        'En el editor funcionan además los estándar: Ctrl + Z deshacer, Ctrl + Shift + Z rehacer, Ctrl + B negrita, Ctrl + I cursiva y Ctrl + U subrayado.'
      ],
      en: [
        'Ctrl + K opens the command palette; Ctrl + S saves at once; Ctrl + , opens Settings; Ctrl + Shift + F toggles focus mode; Ctrl + Shift + A opens the AI assistant; Alt + 1 to 4 jump between views (Write, Codex, Plots, Publish); Escape closes any modal or open panel.',
        'Inside the editor the standard keys work as well: Ctrl + Z undo, Ctrl + Shift + Z redo, Ctrl + B bold, Ctrl + I italic and Ctrl + U underline.'
      ]
    },
    tips: {
      es: ['La paleta de comandos entiende sinónimos: escribe "escena", "nuevo" o "exportar" y filtra al instante.'],
      en: ['The command palette understands synonyms: type "scene", "new" or "export" and it filters at once.']
    }
  },
  {
    id: 'best-practices',
    icon: 'lightbulb',
    title: { es: 'Consejos de uso recomendados', en: 'Recommended usage tips' },
    body: {
      es: [
        'Divide en escenas cortas: el objetivo de palabras por escena y las instantáneas funcionan mejor que un único documento gigante.',
        'Nombra los capítulos como navegación (p. ej. "Cap. 7 — La boda") y usa las notas del árbol para ideas sueltas que aún no son escena.',
        'Antes de cerrar el día, revisa el panel general de la vista Escribir: la sinopsis y el progreso te recuerdan por dónde continuar mañana.',
        'Exporta un .novelcraft tras cada hito importante (fin de acto, entrega a beta-lectores): es tu copia portable y atómica.',
        'Los datos viven en tu carpeta de documentos (NovelCraft); inclúyela en la copia de seguridad habitual de tu sistema.'
      ],
      en: [
        'Split into short scenes: per-scene word goals and snapshots work better than one giant document.',
        'Name chapters like navigation (e.g. "Ch. 7 — The wedding") and use tree notes for loose ideas that are not scenes yet.',
        'Before closing the day, check the Write view overview panel: the synopsis and progress remind you where to continue tomorrow.',
        'Export a .novelcraft file after every milestone (end of an act, beta-reader delivery): it is your portable, atomic copy.',
        'Data lives in your documents folder (NovelCraft); include it in your usual system backup.'
      ]
    },
    tips: {
      es: ['Si dudas entre dos funcionalidades, la paleta de comandos (Ctrl + K) siempre te dice qué existe y cómo se llama.'],
      en: ['If you are torn between two features, the command palette (Ctrl + K) always tells you what exists and what it is called.']
    }
  }
]

export function guideLanguage(language: string): GuideLang {
  return language === 'en' ? 'en' : 'es'
}
