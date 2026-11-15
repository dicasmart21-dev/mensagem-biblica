// Converte a Bíblia Livre (JSON do projeto scrollmapper/bible_databases, arquivo
// formats/json/PorBLivre.json) em um arquivo por livro:
// resources/biblia/<id>.json = capítulos -> versículos (índice 0 = versículo 1).
// Uso: node scripts/build-bible.mjs <PorBLivre.json>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const [source] = process.argv.slice(2)
if (!source) {
  console.error('Uso: node scripts/build-bible.mjs <PorBLivre.json>')
  process.exit(1)
}

// [id do app, nº de capítulos esperado], na ordem canônica (a mesma de src/shared/books.ts).
const BOOKS = `gn 50|ex 40|lv 27|nm 36|dt 34|js 24|jz 21|rt 4|1sm 31|2sm 24|1rs 22|2rs 25|1cr 29|2cr 36|ed 10|ne 13|
et 10|jo 42|sl 150|pv 31|ec 12|ct 8|is 66|jr 52|lm 5|ez 48|dn 12|os 14|jl 3|am 9|ob 1|jn 4|mq 7|na 3|hc 3|sf 3|ag 2|
zc 14|ml 4|mt 28|mc 16|lc 24|joa 21|at 28|rm 16|1co 16|2co 13|gl 6|ef 6|fp 4|cl 4|1ts 5|2ts 3|1tm 6|2tm 4|tt 3|fm 1|
hb 13|tg 5|1pe 5|2pe 3|1jo 5|2jo 1|3jo 1|jd 1|ap 22`
  .replace(/\n/g, '')
  .split('|')
  .map((s) => s.split(' '))

const { books } = JSON.parse(readFileSync(source, 'utf8'))
if (books.length !== BOOKS.length) throw new Error(`Esperados 66 livros, encontrados ${books.length}`)

mkdirSync('resources/biblia', { recursive: true })
let verses = 0
let missing = 0
for (const [i, [id, expected]] of BOOKS.entries()) {
  const src = books[i].chapters
  if (src.length !== Number(expected)) {
    throw new Error(`${id}: esperados ${expected} capítulos, encontrados ${src.length}`)
  }
  const chapters = src.map((chapter, c) => {
    if (chapter.chapter !== c + 1) throw new Error(`${id}: capítulo fora de ordem`)
    const out = []
    for (const v of chapter.verses) {
      out[v.verse - 1] = v.text.replace(/\s+/g, ' ').replace(/ ([;,.:!?])/g, '$1').trim()
    }
    for (let v = 0; v < out.length; v++) out[v] ??= ''
    const filled = out.filter(Boolean).length
    if (filled === 0) throw new Error(`${id} ${c + 1}: capítulo vazio`)
    verses += filled
    missing += out.length - filled
    return out
  })
  writeFileSync(`resources/biblia/${id}.json`, JSON.stringify(chapters))
}
console.log(`66 livros, ${verses} versículos com texto, ${missing} sem texto nesta tradução`)
