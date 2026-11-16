---
name: palavra-diaria-mensal
description: Gera em lote, aqui no chat, os textos do app Palavra Diária (frase de impacto, post para o X, legenda do Instagram e reflexão luterana de cada capítulo bíblico) a partir do arquivo de pedido que o app exporta (pedido-AAAA-MM.json), e devolve o arquivo textos-AAAA-MM.json para importar no app. Use esta skill sempre que o usuário enviar um arquivo de pedido do Palavra Diária, pedir para gerar as mensagens ou os textos bíblicos do mês, falar em "Palavra Diária", ou pedir para continuar uma geração mensal que parou no meio, mesmo que não cite a skill pelo nome.
---

# Palavra Diária: geração mensal no chat

O Palavra Diária é um app desktop que publica uma mensagem bíblica por dia, um capítulo por dia, numa ordem própria de rotação. Ele sabe gerar os textos pela API, mas isso tem custo por uso; esta skill faz o mesmo trabalho aqui no chat, um mês de cada vez. O app continua sendo a memória de tudo: ele decide quais dias faltam e quais frases já foram usadas, e manda isso num arquivo de pedido. Seu trabalho é escrever os textos desses dias e devolver um arquivo que o app importa.

Uma pessoa revisa e aprova cada dia no app antes de publicar, então o que você entrega são rascunhos bons, não versões finais intocáveis.

## O que você precisa receber

Um arquivo `pedido-AAAA-MM.json` anexado pelo usuário. Ele traz:

- `instrucoes`: as instruções de estilo e de teologia dos quatro textos. São as mesmas que o app usa na API, e é isso que mantém o estilo igual entre os dois caminhos. Siga-as à risca; quando algo aqui parecer conflitar com elas, valem as do pedido.
- `dias`: os dias a escrever, cada um com número do dia, data, capítulo e o texto do capítulo na tradução do usuário.
- `limites`: tamanho máximo do post e faixa de palavras da reflexão.
- `frases_anteriores`: frases de impacto já usadas em outros dias.

Se não houver pedido anexado, não invente a lista de capítulos nem escreva "de cabeça": a ordem dos capítulos e o que já foi gerado só o app sabe, e textos fora do pedido não entram na importação. Explique ao usuário como obter o arquivo: no app, aba **Calendário**, vá até o mês desejado e clique em **Salvar pedido…**; depois anexe o arquivo aqui.

## Como trabalhar

Use o script `scripts/palavra.py` desta skill para tudo que é mecânico (ler o pedido, contar caracteres e palavras, montar o arquivo final). Ele existe porque contar 280 caracteres ou 400–700 palavras de cabeça falha, e porque o pedido é grande demais para carregar inteiro no contexto de uma vez.

Escolha uma pasta de trabalho gravável (por exemplo `trabalho/` no diretório atual) e use sempre a mesma.

### 1. Entender o pedido

```bash
python scripts/palavra.py resumo <pedido.json> <pasta_trabalho>
```

Mostra o mês, a tradução, os limites, os dias que faltam e as instruções de estilo completas. Leia as instruções com atenção antes de escrever qualquer coisa. Diga ao usuário, em uma linha, quantos dias vai gerar.

### 2. Ver as frases já usadas

```bash
python scripts/palavra.py frases <pedido.json> <pasta_trabalho>
```

Lista as frases de impacto de meses anteriores e as que você já escreveu neste pedido. O leitor acompanha as mensagens dia após dia, então repetição cansa: não repita essas frases nem as parafraseie de perto, e varie também as aberturas das reflexões e das legendas ao longo do mês (não comece vários dias com a mesma fórmula).

### 3. Escrever um dia de cada vez, na ordem

Para cada dia que falta:

1. Leia o capítulo:
   ```bash
   python scripts/palavra.py capitulo <pedido.json> <dia>
   ```
2. Escreva os quatro textos seguindo as `instrucoes`. As citações bíblicas vêm literalmente desse texto, com o número do versículo.
3. Salve em `<pasta_trabalho>/dia-NNNN.md` (número do dia com quatro dígitos, ex.: `dia-0017.md`), exatamente com estas quatro seções:
   ```
   # frase_impacto
   Uma única frase, em uma linha.

   # post_x
   O post completo.

   # legenda_instagram
   A legenda, com as hashtags na última linha.

   # reflexao
   Primeiro parágrafo.

   Segundo parágrafo.
   ```
   Dentro das seções, escreva texto puro: sem títulos, sem negrito, sem listas.
4. Confira o dia na hora, enquanto o capítulo ainda está fresco:
   ```bash
   python scripts/palavra.py verificar <pedido.json> <pasta_trabalho> <dia>
   ```
   Se aparecer algum problema (post longo, reflexão fora da faixa, frase repetida), reescreva o trecho e confira de novo antes de passar ao próximo dia.

Escreva cada dia com o mesmo cuidado do primeiro. O risco de um lote de trinta é os últimos saírem genéricos; cada capítulo merece uma reflexão que nasce do texto dele, não um molde preenchido.

Não despeje os textos na conversa: eles vão para os arquivos. Na conversa, basta avisar o andamento de tempos em tempos (por exemplo, a cada cinco dias).

### 4. Montar e entregar

Quando todos os dias estiverem escritos e conferidos:

```bash
python scripts/palavra.py montar <pedido.json> <pasta_trabalho> <pasta_saida>
```

Isso confere tudo de novo e grava `textos-AAAA-MM.json` na pasta de saída (use a pasta de onde o usuário consegue baixar arquivos). Entregue esse arquivo ao usuário e diga como importar: no app, aba **Calendário** → **Importar textos…**. Os dias entram como rascunho, para revisar e aprovar.

## Se o trabalho for interrompido

Um mês inteiro é longo e pode não caber numa resposta só. Os arquivos `dia-NNNN.md` são o seu progresso salvo.

- Ao retomar (o usuário diz "continue", ou a conversa segue depois de um corte), rode `resumo` outra vez: ele mostra o que já está escrito e o que falta. Continue do primeiro dia que falta, sem reescrever os prontos.
- Se não der para terminar nesta conversa, entregue o que há:
  ```bash
  python scripts/palavra.py montar <pedido.json> <pasta_trabalho> <pasta_saida> --parcial
  ```
  O app importa o arquivo parcial normalmente. Avise o usuário de quantos dias ficaram de fora e que basta salvar um novo pedido no app depois de importar: ele trará só os dias que ainda faltam.

## O que o app faz com o arquivo

Saber disso ajuda a não quebrar a importação:

- O app confere que o capítulo de cada dia bate com a rotação dele. Por isso o número do dia e o nome do capítulo saem do pedido, pelo script, e não são digitados à mão.
- Dias que já têm textos no app são pulados, nunca sobrescritos.
- Se qualquer dia do arquivo estiver inválido, o app recusa o arquivo inteiro. O comando `montar` só gera o arquivo quando tudo passa na conferência.
