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
  /** Tradução usada na geração: a embutida ou uma importada pelo usuário. */
  bible: { source: 'embedded' | 'imported'; name: string }
}

/** Os quatro textos gerados para um dia. */
export interface Texts {
  impact: string
  xPost: string
  instagram: string
  reflection: string
}

export type TextField = keyof Texts

export const TEXT_FIELDS: readonly TextField[] = ['impact', 'xPost', 'instagram', 'reflection']

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

/** Resumo de um dia para o histórico. */
export interface EntrySummary {
  day: number
  status: EntryStatus
  impact: string
  generatedAt: string
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
  /** Abre o seletor de arquivo e importa uma Bíblia em JSON. `null` se o usuário cancelar. */
  importBible(): Promise<Result<Settings> | null>
  /** Descarta a Bíblia importada e volta para a embutida. */
  useEmbeddedBible(): Promise<Result<Settings>>
  getEntry(day: number): Promise<Entry | null>
  /** Estado de cada dia que já tem textos, no intervalo dado (inclusive). */
  getStatuses(fromDay: number, toDay: number): Promise<Record<number, EntryStatus>>
  /** Dias com textos, do mais recente ao mais antigo, filtrados por busca e estado. */
  searchEntries(query: string, status: EntryStatus | 'all'): Promise<EntrySummary[]>
  /** Gera (ou gera de novo) os quatro textos do dia e salva como rascunho. */
  generate(day: number): Promise<Result<Entry>>
  /** Reescreve só um dos quatro textos de um rascunho. */
  regenerateText(day: number, field: TextField): Promise<Result<Entry>>
  /** Salva edições manuais em um rascunho. */
  saveTexts(day: number, texts: Texts): Promise<Result<Entry>>
  approve(day: number): Promise<Result<Entry>>
  /** Devolve um dia aprovado para rascunho, para poder editar de novo. */
  reopen(day: number): Promise<Result<Entry>>
  copyText(text: string): Promise<void>
}

declare global {
  interface Window {
    api: AppApi
  }
}
