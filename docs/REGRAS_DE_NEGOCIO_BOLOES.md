# Regras de Negocio dos Boloes

## 1. Objetivo

Este documento formaliza as regras de negocio vigentes do sistema de boloes da Copa do Mundo FIFA 2026 no projeto `BolaoPro`.

As regras abaixo valem para as modalidades:

- `score`: bolao de palpites de placar por partida
- `podium`: bolao de palpites do podio oficial da Copa

## 2. Fontes Oficiais de Verdade

O sistema utiliza duas fontes oficiais persistidas no banco:

- `public.matches`
  - guarda o cronograma oficial da Copa
  - guarda os placares homologados jogo a jogo
  - guarda os jogos do mata-mata preparados para receber os classificados

- `public.tournament_podium`
  - guarda o podio oficial da Copa
  - comeca com o podio provisório baseado no ranking da FIFA
  - e atualizado para o resultado oficial ao final da Copa

## 3. Regra Oficial do Ranking

Cada entrada paga e concluida gera uma `aposta individual`, identificada por `bet_id`.

Para montar o ranking de um bolao:

1. o sistema calcula a pontuacao de cada `bet_id`
2. soma a pontuacao de todas as apostas do mesmo apostador dentro daquele bolao
3. gera um ranking publico por `apostador`
4. exibe somente os apostadores que tiverem `pontuacao maior que zero`

Consequencia direta:

- se um apostador fez uma aposta, entra no ranking com a pontuacao dessa aposta
- se um apostador fez varias apostas no mesmo bolao, entra no ranking com a `pontuacao acumulada` de todas elas
- se um apostador ainda nao pontuou, ele nao aparece no ranking publico daquele bolao
- isso vale para qualquer modalidade

## 4. Exibicao na Interface

Cada bolao criado possui sua propria classificacao publica na secao `Classificacao`.

A exibicao da secao deve seguir este formato:

- todos os boloes criados aparecem como cards publicos
- cada card pode ser expandido e retraido pelo apostador
- ao expandir, o card mostra o ranking publico do respectivo bolao

Para cada bolao exibido, a interface deve mostrar:

- a posicao real do apostador no ranking daquele bolao
- a pontuacao acumulada dele naquele bolao
- a tabela publica do ranking daquele bolao

Se o apostador ainda nao pontuou:

- o topo da tela mostra que ele esta `sem pontuacao neste bolao`
- ele nao aparece na tabela publica

## 5. Faixa de Premiados

O sistema identifica quantos apostadores entram na faixa premiada com base nas configuracoes do tenant:

- `firstPlacePct > 0` habilita o 1o colocado
- `secondPlacePct > 0` habilita o 2o colocado
- `thirdPlacePct > 0` habilita o 3o colocado

Logo:

- se houver 3 percentuais maiores que zero, o bolao mostra os `3 provaveis premiados`
- se houver 2, mostra os `2 provaveis premiados`
- se houver 1, mostra apenas o lider como `provavel premiado`

## 6. Status do Ranking

Os status mostrados na interface seguem a evolucao do torneio:

- `Provavel 1o`, `Provavel 2o`, `Provavel 3o`
  - usados quando o ranking ainda esta parcial
  - indicam quem esta ocupando a faixa premiada no momento

- `Vencedor 1o`, `Vencedor 2o`, `Vencedor 3o`
  - usados quando o ranking fica oficial
  - indicam os apostadores definitivamente premiados

- `Em disputa`
  - usado para apostadores que pontuaram, mas estao fora da faixa premiada naquele momento

## 7. Regras do Bolao de Placar (`score`)

### 7.1. Fonte de Calculo

- usa as partidas oficiais salvas em `public.matches`
- so entram no calculo as partidas do bolao com `status = finished`

### 7.2. Pontuacao por Partida

- `25 pontos` por acerto exato do placar
- `10 pontos` por acerto do resultado final e do saldo de gols, sem acertar o placar exato
- `5 pontos` por acerto apenas do resultado final
- `0 pontos` por erro do resultado final

### 7.2.1. Como o saldo de gols influencia

Para efeitos desta regra, `saldo de gols` significa a diferenca entre os gols do `time A` e os gols do `time B`.

Exemplos:

- resultado oficial `3x2` = saldo `+1`
- resultado oficial `2x1` = saldo `+1`
- resultado oficial `1x0` = saldo `+1`
- resultado oficial `0x0` = saldo `0`
- resultado oficial `1x3` = saldo `-2`

Essa diferenca influencia diretamente a pontuacao parcial do bolao de placar:

- se o apostador acerta o `placar exato`, recebe `25 pontos`
- se o apostador nao acerta o placar exato, mas acerta o `mesmo resultado final` e o `mesmo saldo de gols`, recebe `10 pontos`
- se o apostador acerta apenas o `resultado final`, mas erra o saldo de gols, recebe `5 pontos`
- se o apostador erra o resultado final, recebe `0 pontos`

Exemplo pratico com resultado oficial `3x2`:

- palpite `3x2` = `25 pontos`
- palpite `2x1` = `10 pontos`, porque acertou vitoria do time A e saldo `+1`
- palpite `1x0` = `10 pontos`, porque acertou vitoria do time A e saldo `+1`
- palpite `4x2` = `5 pontos`, porque acertou vitoria do time A, mas errou o saldo
- palpite `1x1` = `0 pontos`, porque errou o resultado final

Exemplo pratico com resultado oficial `0x0`:

- palpite `0x0` = `25 pontos`
- palpite `1x1` = `10 pontos`, porque acertou empate e saldo `0`
- palpite `2x2` = `10 pontos`, porque acertou empate e saldo `0`
- palpite `1x0` = `0 pontos`, porque errou o resultado final

### 7.3. Regra de Acumulacao

- cada aposta finalizada recebe sua propria pontuacao
- se o mesmo apostador tiver varias apostas no mesmo bolao de placar, a pontuacao final dele no ranking sera a soma de todas as apostas pontuadas

### 7.4. Ranking Oficial

- o ranking do bolao de placar vira oficial quando todas as partidas selecionadas por aquele bolao estiverem finalizadas
- nesse momento os `provaveis premiados` passam a ser `vencedores oficiais`

## 8. Regras do Bolao de Podio (`podium`)

### 8.1. Fonte de Calculo

- usa o podio oficial salvo em `public.tournament_podium`

### 8.2. Pontuacao por Posicao

- `25 pontos` quando o apostador acerta exatamente a selecao na posicao correta
- `0 pontos` quando a selecao existe no podio, mas foi colocada na posicao errada

### 8.3. Regra de Acumulacao

- cada aposta finalizada recebe sua propria pontuacao
- se o mesmo apostador tiver varias apostas no mesmo bolao de podio, a pontuacao final dele no ranking sera a soma de todas as apostas pontuadas

### 8.4. Visibilidade no Ranking

- o ranking do bolao de podio mostra apenas quem ja tiver pontuado
- nao existe mais ocultacao por corte minimo de premiacao
- se o apostador tiver `0 pontos`, ele fica fora da tabela publica ate pontuar

### 8.5. Ranking Oficial

- enquanto `public.tournament_podium` estiver provisoria, o ranking mostra os `provaveis premiados`
- quando as posicoes do podio deixam de ser provisórias, o ranking passa a mostrar os `vencedores oficiais`

## 9. Atualizacao Automatica do Podio Oficial

O `public.tournament_podium` deve ser atualizado automaticamente pelos jogos finais da Copa:

- `jogo 104`
  - define `1o lugar` e `2o lugar`
  - vencedor da final = campeao
  - perdedor da final = vice-campeao

- `jogo 103`
  - define `3o lugar` e `4o lugar`
  - vencedor da disputa de 3o = terceiro colocado
  - perdedor da disputa de 3o = quarto colocado

Quando esses jogos forem homologados:

- o sistema substitui os valores provisórios pelas selecoes reais
- marca as posicoes atualizadas como `official_result`
- retira a marcacao de provisório dessas posicoes

## 10. Criterios de Desempate

### 10.1. Bolao de Placar

O desempate segue esta ordem:

1. maior pontuacao acumulada
2. maior numero acumulado de placares exatos
3. maior numero acumulado de acertos de resultado com saldo correto
4. maior numero acumulado de acertos de resultado
5. maior accuracy acumulada
6. menor tempo de finalizacao da aposta, considerando data, hora, minuto e segundo

### 10.2. Bolao de Podio

O desempate segue esta ordem:

1. maior pontuacao acumulada
2. maior numero acumulado de acertos exatos
3. maior accuracy acumulada
4. menor tempo de finalizacao da aposta, considerando data, hora, minuto e segundo

## 11. Consequencia Comercial da Regra

Esta arquitetura garante ao mesmo tempo:

- multiplas apostas por apostador
- valorizacao de quem comprou mais chances
- ranking publico por bolao
- leitura simples para o apostador
- exibicao direta da posicao real e da pontuacao acumulada

## 12. Implementacao Atual no Sistema

As regras deste documento estao refletidas em:

- `src/lib/rankingEngine.ts`
- `src/lib/supabaseService.ts`
- `src/components/ApostadorDashboard.tsx`
- `src/lib/podiumRanking.ts`

## 13. Decisao Consolidada

Fica oficializado que no BolaoPro:

- cada aposta concluida gera uma pontuacao individual
- o ranking de cada bolao soma as pontuacoes das apostas do mesmo apostador
- o ranking publico mostra apenas quem ja pontuou
- o topo da tela mostra a posicao real do apostador e sua pontuacao acumulada no bolao ativo
- a faixa premiada aparece como `provavel` antes do encerramento
- a faixa premiada passa a `oficial` quando o resultado do bolao estiver encerrado
