/// <reference types="vite/client" />
import type { NovelCraftApi } from '../../shared/types'

declare global {
  interface Window {
    novelcraft: NovelCraftApi
  }
}

export {}
