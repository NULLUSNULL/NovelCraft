import type { EntityKind, ID } from '@shared/types'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    entityLink: {
      setEntityLink: (attributes: {
        href: string
        entityKind?: EntityKind | null
        entityId?: ID | null
      }) => ReturnType
    }
  }
}

export {}
