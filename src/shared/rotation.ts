import { BOOKS, type Book } from './books'

export interface Reference {
  /** Dia dentro do ciclo, de 1 a TOTAL_DAYS. */
  day: number
  book: Book
  chapter: number
  /** Texto pronto para exibir, ex.: "Gênesis 1". */
  label: string
}

/**
 * Sequência completa do ciclo: a volta N percorre os livros na ordem canônica
 * usando o capítulo N; livros com menos de N capítulos já saíram da rotação.
 */
function buildSequence(): Reference[] {
  const sequence: Reference[] = []
  const longest = Math.max(...BOOKS.map((b) => b.chapters))
  for (let chapter = 1; chapter <= longest; chapter++) {
    for (const book of BOOKS) {
      if (book.chapters < chapter) continue
      sequence.push({
        day: sequence.length + 1,
        book,
        chapter,
        label: `${book.name} ${chapter}`
      })
    }
  }
  return sequence
}

const SEQUENCE: readonly Reference[] = buildSequence()

/** Duração do ciclo completo em dias (um por capítulo da Bíblia). */
export const TOTAL_DAYS = SEQUENCE.length

/**
 * Capítulo de um dia da sequência (dia 1 = Gênesis 1).
 * Depois do último dia o ciclo recomeça em Gênesis 1.
 */
export function referenceForDay(dayNumber: number): Reference {
  if (!Number.isInteger(dayNumber) || dayNumber < 1) {
    throw new RangeError(`Dia inválido: ${dayNumber}`)
  }
  return SEQUENCE[(dayNumber - 1) % TOTAL_DAYS]
}

/** Em que ciclo cai um dia da sequência (1 para os primeiros TOTAL_DAYS dias). */
export function cycleForDay(dayNumber: number): number {
  return Math.floor((dayNumber - 1) / TOTAL_DAYS) + 1
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Converte "AAAA-MM-DD" em número de dias corridos, sem depender de fuso ou horário de verão. */
function toEpochDay(isoDate: string): number {
  const m = ISO_DATE.exec(isoDate)
  if (!m) throw new RangeError(`Data inválida: ${isoDate}`)
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const ms = Date.UTC(y, mo - 1, d)
  const check = new Date(ms)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new RangeError(`Data inválida: ${isoDate}`)
  }
  return ms / 86_400_000
}

/**
 * Número do dia na sequência para uma data, dado o dia 1.
 * Retorna null para datas anteriores ao início.
 */
export function dayNumberForDate(startDate: string, date: string): number | null {
  const diff = toEpochDay(date) - toEpochDay(startDate)
  return diff < 0 ? null : diff + 1
}

/** Capítulo de uma data do calendário, ou null se for anterior ao início. */
export function referenceForDate(startDate: string, date: string): Reference | null {
  const day = dayNumberForDate(startDate, date)
  return day === null ? null : referenceForDay(day)
}

/** Data de calendário ("AAAA-MM-DD") de um dia da sequência. */
export function dateForDayNumber(startDate: string, dayNumber: number): string {
  const ms = (toEpochDay(startDate) + dayNumber - 1) * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/** Data local de hoje como "AAAA-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
