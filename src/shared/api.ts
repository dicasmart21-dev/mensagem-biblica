export interface Settings {
  /** Data do dia 1 (Gênesis 1), "AAAA-MM-DD". */
  startDate: string
}

/** Funções que a interface pode chamar no processo principal. */
export interface AppApi {
  getSettings(): Promise<Settings>
  setStartDate(startDate: string): Promise<Settings>
}

declare global {
  interface Window {
    api: AppApi
  }
}
