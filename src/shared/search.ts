/** Texto em minúsculas e sem acentos, para busca ("genesis" encontra "Gênesis"). */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Verdadeiro se todas as palavras da busca aparecem no texto, em qualquer ordem. */
export function matches(haystack: string, query: string): boolean {
  const folded = fold(haystack)
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => folded.includes(word))
}
