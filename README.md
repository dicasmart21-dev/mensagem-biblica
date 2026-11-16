# Palavra Diária

App desktop (Electron) de mensagens bíblicas diárias. Cada dia usa o capítulo seguinte na ordem dos livros
(dia 1 Gênesis 1, dia 2 Êxodo 1… dia 66 Apocalipse 1, dia 67 Gênesis 2); livros que terminam saem da rotação.
Para cada dia, a API do Claude gera frase de impacto, post para o X, legenda do Instagram e uma reflexão de
400–700 palavras com lente luterana. Nada é marcado como aprovado sem revisão.

## Rodar em desenvolvimento

```bash
npm install
npm run dev
```

Na primeira abertura, informe a chave da API do Claude em Configurações.

## Testes

```bash
npm test
npm run typecheck
```

## Gerar o instalador do Windows

No Windows, sem nada além do Node.js:

```bash
npm install
npm run dist:win
```

Sem instalar nada: na aba **Actions** do repositório no GitHub, abra "Instalador do Windows" e clique em
**Run workflow**; o instalador aparece em **Releases** alguns minutos depois.

O instalador sai em `dist/Palavra-Diaria-Setup-<versão>.exe`. Em Linux o mesmo comando funciona se o Wine
(64 e 32 bits) estiver instalado. O instalador não é assinado, então o Windows mostra o aviso do SmartScreen
na primeira execução.

## Dados

- Textos gerados, configurações e a Bíblia importada ficam na pasta de dados do usuário do sistema, fora do repositório.
- A chave da API é gravada cifrada pelo cofre de senhas do sistema operacional.
- Texto bíblico embutido: Bíblia Livre (`resources/biblia`, gerado por `scripts/build-bible.mjs`). Outra tradução pode
  ser importada em Configurações a partir de um arquivo JSON.

## Gerar o mês pelo chat (sem custo de API)

1. No app, aba **Calendário**, vá ao mês desejado e clique em **Salvar pedido…**. O arquivo `pedido-AAAA-MM.json`
   traz só os dias que ainda não têm textos, o texto dos capítulos, as instruções de estilo e as frases já usadas.
2. No chat do Claude, com a skill `palavra-diaria-mensal` instalada (`skill/palavra-diaria-mensal.skill`), anexe o
   pedido e peça para gerar os textos do mês.
3. Baixe o `textos-AAAA-MM.json` que o Claude devolver e, no app, clique em **Importar textos…**. Os dias entram
   como rascunho; dias que já tinham textos não são alterados.

As instruções de estilo têm uma única fonte (`src/shared/prompt.ts`) e viajam dentro do pedido, então a API e o
chat escrevem com as mesmas regras.
