# 📖 NovelCraft

> ✒️ **Un estudio literario completo para planificar, escribir y publicar novelas.**
> Aplicación de escritorio multiplataforma (Windows, macOS y Linux) que funciona 100 % offline con tus archivos en tu disco.

![Versión](https://img.shields.io/badge/versi%C3%B3n-1.0.0-93b494) ![Electron](https://img.shields.io/badge/Electron-45-47848f) ![React](https://img.shields.io/badge/React-19-61dafb) ![Licencia](https://img.shields.io/badge/uso-privado-c9a86a)

Si te gusta, ¡puedes apoyarme invitándome a un café!

[![Apóyame en Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nullusnull)

---

## ✨ Características

- 📚 **Biblioteca de proyectos** — tarjetas con portada, autor/a, género, recuento de palabras y progreso hacia el objetivo. Importa y exporta archivos `.novelcraft` como copia portable.
- ✍️ **Editor WYSIWYG** (TipTap 3) — formato enriquecido completo, menú flotante al seleccionar, menú contextual, autoguardado y objetivo de palabras por escena.
- 🧙 **Modo concentración** — oculta paneles para escribir sin distracciones (`Ctrl + Shift + F`).
- 👥 **Códex** — fichas de personajes, lugares y objetos con relaciones, etiquetas, color e imagen; se enlazan automáticamente con las escenas.
- 🕸️ **Tablero de tramas** (React Flow) — tarjetas arrastrables con premisa, conflicto y resolución; conexiones tipadas entre tramas (causa, conflicto, convergencia, contrapunto).
- 🕓 **Historial por escena** — instantáneas manuales y automáticas; restaura cualquier versión anterior en un clic.
- 🛡️ **Copias de seguridad** — ZIPs manuales y automáticos por proyecto, copia opcional al salir y papelera con retención configurable.
- 🚀 **Publicación** — exporta a PDF, EPUB, HTML, Markdown y TXT; portada y página de título incluidas.
- ✨ **IA opcional** — proveedores locales (Ollama, LM Studio) o en la nube (OpenAI, Anthropic); acciones sobre la selección de texto; claves cifradas con `safeStorage`. La app funciona igual sin IA.
- 🎨 **Temas y apariencia** — oscuro, sepia, claro y sistema; seis colores de énfasis (Salvia por defecto); **tamaño de la interfaz ajustable del 80 % al 150 %**.
- ⌨️ **Paleta de comandos** (`Ctrl + K`) — cualquier acción de la app a dos teclas.
- 🗺️ **Tour de bienvenida y guía de uso** — tour omisible en la primera ejecución y guía completa dentro de *Ajustes → Acerca de*, con buscador y disponible en español e inglés.
- 🔒 **Tus datos son tuyos** — proyectos en archivos abiertos dentro de tu carpeta de documentos; sin cuenta, sin nube obligatoria.

## 🖥️ Capturas del flujo de trabajo

| Vista             | Qué hace                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- |
| 📚 **Biblioteca** | Gestiona tus novelas: crear, importar, exportar, revelar carpeta, papelera.              |
| ✍️ **Escribir**   | Manuscrito con árbol de capítulos/escenas/notas, inspector de metadatos y panel general. |
| 👥 **Códex**      | La biblia de tu historia: personajes, lugares y objetos conectados con las escenas.      |
| 🕸️ **Tramas**    | Tablero visual de hilos narrativos y sus conexiones.                                     |
| 🚀 **Publicar**   | Compila el manuscrito a PDF, EPUB, HTML, MD o TXT.                                       |

## ⌨️ Atajos de teclado

| Atajo              | Acción                                               |
| ------------------ | ---------------------------------------------------- |
| `Ctrl + K`         | Paleta de comandos                                   |
| `Ctrl + S`         | Guardar de inmediato                                 |
| `Ctrl + ,`         | Ajustes                                              |
| `Ctrl + Shift + F` | Modo concentración                                   |
| `Ctrl + Shift + A` | Asistente de IA                                      |
| `Alt + 1 … 4`      | Cambiar de vista (Escribir, Códex, Tramas, Publicar) |
| `Escape`           | Cerrar modal o panel abierto                         |

## 🚀 Desarrollo

### Requisitos

| Elemento    | Valor                                        |
| ----------- | -------------------------------------------- |
| **Node.js** | ≥ 20                                         |
| **npm**     | incluido con Node                            |
| **SO**      | Windows, macOS o Linux (compila en los tres) |

### Arranque rápido

```bash
# 1️⃣ Instalar dependencias
npm install

# 2️⃣ Desarrollo con recarga en caliente
npm run dev

# 3️⃣ Verificación de tipos + compilación
npm run build

# 4️⃣ Probar la build compilada
npm run start
```

### Scripts disponibles

| Script                  | Qué hace                                           |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Desarrollo con HMR (electron-vite dev)             |
| `npm run start`         | Ejecuta la build compilada (electron-vite preview) |
| `npm run typecheck`     | TypeScript en proceso principal y renderer         |
| `npm run build`         | Typecheck + build de producción                    |
| `npm run test`          | Pruebas unitarias (Vitest)                         |
| `npm run test:e2e`      | Pruebas de extremo a extremo (Playwright)          |
| `npm run package`       | Compila y empaqueta para el SO actual              |
| `npm run package:win`   | Instalador de Windows (NSIS)                       |
| `npm run package:mac`   | App de macOS (dmg)                                 |
| `npm run package:linux` | AppImage y .deb de Linux                           |

## 📦 Empaquetado e iconos

La configuración de `electron-builder` vive en el `package.json` (sección `build`):

- 🪟 **Windows** — instalador NSIS con el icono incrustado en el ejecutable (`assets/icon.ico`).
- 🍎 **macOS** — `assets/icon.icns` para la app y el dmg.
- 🐧 **Linux** — set de iconos PNG (`assets/icons/`, 16–512 px) que AppImage incrusta y los `.deb` instalan en `/usr/share/icons`.
- El icono de la ventana en tiempo de ejecución viaja en `extraResources` (`resources/icon.png`) y lo aplica el proceso principal.

```bash
npm run package:win    # -> dist/NovelCraft Setup 1.0.0.exe
npm run package:mac    # -> dist/NovelCraft-1.0.0.dmg
npm run package:linux  # -> dist/*.AppImage y *.deb
```

## 🗂️ Estructura del proyecto

```
NovelCraft/
├─ assets/                     # iconos de la app (ico, icns, png) para el empaquetado
├─ electron.vite.config.ts     # configuración de build y aliases
├─ src/
│  ├─ main/                    # proceso principal de Electron
│  │   ├─ index.ts             # ventana, ciclo de vida, cierre con backup
│  │   ├─ storage.ts           # rutas de datos
│  │   ├─ projects.ts          # CRUD de proyectos, backups, papelera
│  │   ├─ settings.ts          # ajustes cifrados
│  │   ├─ ai.ts                # proveedores de IA
│  │   └─ exporter.ts          # exportación PDF/EPUB/HTML/MD/TXT
│  ├─ preload/                 # puente seguro window.novelcraft
│  └─ renderer/
│     ├─ App.tsx               # shell, vistas y modales
│     ├─ styles/globals.css    # temas y estilos
│     ├─ components/
│     │   ├─ help/             # guía de uso y tour de bienvenida
│     │   ├─ settings/         # modal de ajustes
│     │   └─ …                 # editor, códex, tramas, publicar…
│     └─ store/                # Zustand + Immer
└─ out/                        # salida de npm run build
```

## 🧭 Datos y ajustes

- 📁 **Proyectos**: `Documentos/NovelCraft/` — cada proyecto es una carpeta con `project.json`, documentos y backups.
- ⚙️ **Ajustes**: `userData/NovelCraft/data/settings.json` — se guardan solos; las claves de API se cifran con `safeStorage`.
- 🔧 **Carpeta de datos personalizada**: variable de entorno `NOVELCRAFT_DATA_DIR=/ruta/a/datos`.
- 🧳 **Portabilidad**: exporta un `.novelcraft` desde la biblioteca y ábrelo en otro equipo; viaja con todo y sus backups.

## 🆘 Ayuda dentro de la app

- 🧙 **Tour de bienvenida**: aparece solo en la primera ejecución y se puede omitir.
- 📖 **Guía de uso**: *Ajustes → Acerca de → "Guía de uso"* — guía completa con buscador, organizada por secciones y en español e inglés.

## 🗺️ Hoja de ruta

| Pendiente                                                                   | Prioridad |
| --------------------------------------------------------------------------- | --------- |
| Ampliar las pruebas E2E (flujo completo: proyecto → IA → exportar → backup) | Media     |
| Revisar breakpoints del panel general en ventanas muy estrechas             | Baja      |
| Plantillas de proyecto (trilogía, guion, relato corto)                      | Baja      |

---

Hecho con 🪶 por **NULLUSNULL** · [GitHub](https://github.com/NULLUSNULL/NovelCraft) · [![Apóyame en Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nullusnull)
