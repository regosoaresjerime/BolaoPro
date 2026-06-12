# Debug Session: new-pool-pix-400 [OPEN]

## Sintoma
- Ao criar um novo bolao e tentar acessar/pagar para apostar, a interface mostra:
  - `Erro ao iniciar pagamento: Erro HTTP: 400`
- O erro aparece no fluxo de criacao da ordem Pix via PagBank para bolao recem-criado.

## Hipoteses
- O `groupId` do bolao novo esta chegando vazio, temporario ou invalido no checkout.
- O payload enviado para a Edge Function usa `groupName`/descricao inconsistente para bolao novo.
- O bolao novo ainda nao foi sincronizado totalmente no banco quando o checkout e acionado.
- A serializacao do bolao novo difere dos boloes antigos e afeta a criacao da ordem.
- Existe rejeicao no backend ao tentar gravar/relacionar a transacao ao grupo novo.

## Evidencias Coletadas
- Screenshot mostra erro HTTP 400 no `pagbankService.ts` durante `POST` para a Edge Function `pagbank-create-order`.
- O frontend criava o bolao de forma otimista com `id` temporario (`p-...`) antes da sincronizacao com o Supabase.
- O checkout usava `bottomSheetData.id` da lista do lobby; para um bolao novo acessado imediatamente, esse `id` podia ainda ser o temporario, nao o UUID real do banco.
- Foi adicionada instrumentacao no erro do `pagbankService` para expor `groupId`, `groupName`, `amount` e mensagem real retornada pelo backend.
- Os novos logs do pódio mostraram erro `22P02 invalid input syntax for type uuid` para `match_id` como `00000000-0000-0000-0000-9999PODI2222`.
- Isso confirmou que as 4 posicoes do pódio usavam IDs de fallback invalidos no frontend.
- A analise do fluxo de criacao mostrou uma segunda causa: as 4 partidas do pódio eram geradas no cliente, mas podiam nao ser persistidas no Supabase a tempo por depender de estado React assíncrono.
- A causa final confirmada foi o desencontro entre os IDs usados no frontend e os IDs realmente gravados em `matches`: o serviço recriava os IDs na persistencia.
- A interface tambem nao reconstruia o estado de `Pódio Confirmado` apos reload, apesar de carregar `user_picks`.

## Proximo Passo
- Validar no navegador que o bolao de pódio salva sem conflito de chave estrangeira e que as 4 escolhas reaparecem apos atualizar a pagina.
