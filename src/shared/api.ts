export const MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (recomendado)' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (mais rápido e barato)' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (o mais barato)' }
] as const

export type ModelId = (typeof MODELS)[number]['id']
export const DEFAULT_MODEL: ModelId = 'claude-opus-5-5'

/** Configurações como a interface as vê: a chave da API nunca sai do processo principal. */
export interface Settings {
  /** Data do dia 1 (Gênesis 1), "AAAA-MM-DD". */
  startDate: string
  model: ModelId
  hasApiKey: boolean
}

/** Os quatro textos gerados para um dia. */
export interface Texts {
  impact: string
  xPost: string
  instagram: string
  reflection: string
}

export type EntryStatus = 'draft' | 'approved'

export interface Entry {
  /** Dia da sequência (1 = Gênesis 1). */
  day: number
  bookId: string
  chapter: number
  status: EntryStatus
  texts: Texts
  model: string
  generatedAt: string
  updatedAt: string
  approvedAt: string | null
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

/** Funções que a interface pode chamar no processo principal. */
export interface AppApi {
  getSettings(): Promise<Settings>
  setStartDate(startDate: string): Promise<Result<Settings>>
  setModel(model: ModelId): Promise<Result<Settings>>
  /** Salva a chave cifrada no cofre do sistema; string vazia apaga a chave. */
  setApiKey(apiKey: string): Promise<Result<Settings>>
  getEntry(day: number): Promise<Entry | null>
  /** Gera (ou gera de novo) os quatro textos do dia e salva como rascunho. */
  generate(day: number): Promise<Result<Entry>>
}

declare global {
  interface Window {
    api: AppApi
  }
}
