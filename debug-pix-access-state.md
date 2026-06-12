# Debug Session: pix-access-state [RESOLVED]

## Sintoma
- Pagamento via Pix aparece como confirmado.
- Ao clicar para dar palpites, a tela ainda mostra inscricao/pix pendente.

## Hipoteses
- O sucesso visual do checkout nao atualiza o estado que libera os palpites.
- A regra de liberacao usa um flag global e nao a adesao ao bolao especifico.
- O fluxo de sucesso nao persiste a entrada do usuario no grupo pago.
- A tela de palpites le um status antigo/local e ignora o estado confirmado.
- O fluxo do bolao de podio diverge da regra das partidas comuns.

## Evidencias Coletadas
- `App.tsx` inicia `hasPaidInscricao` como `true`.
- `App.tsx` passa `onClearPaid={() => setHasPaidInscricao(!hasPaidInscricao)}`.
- `ApostadorDashboard.tsx` usa `hasPaidInscricao` como regra unica para liberar ou bloquear palpites.
- No sucesso do checkout, o botao "Dar Meus Palpites Agora" chama `onClearPaid()`, isto e, faz toggle em vez de marcar pagamento confirmado.
- O fluxo de pagamento seleciona um bolao especifico (`selectedPoolId`), mas a regra de acesso nao esta ligada ao bolao pago.

## Proximo Passo
- Validar no navegador que o Pix confirmado libera apenas o bolao pago e persiste apos recarregar.
