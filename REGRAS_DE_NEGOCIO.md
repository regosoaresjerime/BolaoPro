# Regras de Negócio e Arquitetura - BolãoPro 2026

Este documento detalha o funcionamento completo da versão atual do **BolãoPro 2026**, especificando a lógica das regras de negócio aplicadas, os fluxos de acesso, os mecanismos de apostas/palpites, a contabilidade tributária da banca, e a integração simulada do gateway de pagamentos PagBank.

---

## 1. Arquitetura e Estrutura de Dados (Multi-Tenant)

O sistema foi arquitetado para atuar como uma plataforma **SaaS Multi-Tenant**. Isso significa que múltiplos organizadores (*Tenants*) podem gerenciar seus próprios bolões de forma isolada na mesma base de dados.

### Isolamento via Row Level Security (RLS)
Todas as tabelas críticas possuem Row Level Security (RLS) ativo no PostgreSQL do Supabase, garantindo que:
*   Os administradores (*Tenants*) gerenciem apenas suas partidas, bolões e configurações.
*   Os apostadores vejam apenas os dados que lhes são permitidos.
*   **Segurança Anti-Trapaça (Anti-Cheat):** Um apostador **não** consegue visualizar o palpite de outro apostador até que a respectiva partida tenha sido iniciada/encerrada (`matches.started_at < now()`).

---

## 2. Fluxo de Onboarding e Autenticação

1.  **Lobby de Boas-Vindas:**
    *   Ao acessar o Bolão, o usuário se depara com o Banner Principal contendo métricas sociais ("+1.2k apostadores ativos") e a barra visual de progresso de premiação acumulada do bolão.
    *   **Conformidade com a LGPD:** Um banner regulatório persiste na parte inferior da tela, informando o uso de dados de login e cookies de login antes de permitir o avanço do cadastro.
2.  **Cadastro Seguro:**
    *   O usuário preenche Nome, E-mail e Senha.
    *   **Indicador de Força de Senha:** À medida que o usuário escreve, o componente analisa e categoriza em "Fraca", "Média" ou "Forte" aplicando cores de feedback (vermelho, amarelo, verde).
    *   **Proteção Anti-Spam Matemática:** Há um captcha matemático embarcado exigindo o cálculo `3 + 4 = 7` para evitar cadastros automatizados (bots) na plataforma.

---

## 3. Fluxo de Inscrição e Checkout de Pagamento (Pix PagBank)

Uma vez cadastrado, o usuário entra no modo "Apostador" e tem acesso ao Lobby de seu Bolão. No entanto, para começar a salvar palpites, ele precisa **efetuar a taxa de inscrição (checkout)**.

### O Fluxo de Checkout de Entrada
1.  **Inserção do Código de Convite:**
    *   No Lobby, o usuário digita o link ou código de acesso fornecido pelo organizador (ex: `COPA26` ou `BRASIL`).
    *   Ao validar o código, um drawer inferior (*Bottom Sheet*) desliza de forma responsiva mostrando as métricas daquele bolão específico (Criador, Prêmio Estimado e o valor da Taxa de Inscrição).
2.  **Geração do Pix PagBank (Edge Function):**
    *   Ao clicar em "Fazer Pagamento", o frontend aciona a Edge Function do Supabase `pagbank-pix`.
    *   A Edge function calcula internamente o payload e gera uma string regulamentada de Pix Copia e Cola, retornando um link gerado com o QR Code para escaneamento.
    *   O sistema cria uma transação no banco com o status `pending` e inicia um cronômetro regressivo exato de **5 minutos** (tempo máximo de expiração do Pix).
3.  **Liquidação de Webhook (PagBank Webhook):**
    *   Quando o pagamento é efetuado, o PagBank envia uma requisição `POST` para nossa Edge Function `pagbank-webhook`.
    *   A Edge Function faz a verificação de segurança, muda o status da transação para `paid` e dispara de forma atômica o repasse das comissões (detalhado na seção 5).
    *   *Nota de teste/visualização:* Para fins de avaliação, o modal de checkout possui uma simulação instantânea de processamento que homologa o pagamento após 7 segundos de exibição, liberando as apostas para testes no ambiente.

---

## 4. Funcionamento dos Palpites (Mecanismo Autosave Debounced)

A principal inovação na experiência do apostador é o **Autosave Debounced de 800ms**.

*   **Evitando Botão de "Salvar":** O apostador não precisa se preocupar em clicar em "Enviar" ou "Salvar" para cada palpite inserido.
*   **O Funcionamento Interno:**
    1.  O apostador muda o número de gols no input de qualquer partida ativa.
    2.  O sistema aguarda uma janela de inatividade de **800 milissegundos** no teclado (debounce).
    3.  Caso nenhuma nova alteração ocorra nesse intervalo, o sistema executa a chamada ao banco de dados e exibe um pequeno toast pulsante verde escrito **"Salvar" -> "Salvo"** no respectivo painel do jogo.
*   **Status do Jogo:**
    *   **Partidas Agendadas:** Permitem livre alteração de palpites até 15 minutos antes do início previsto.
    *   **Partidas Encerradas/Ao Vivo:** Os campos são desativados de forma segura (padlocked), exibindo o placar final e o ganho de pontuação obtido pelo apostador.

### 4.1 Fluxo de Novas Apostas e Persistência
- **Fluxo Principal de Nova Aposta**: Para fazer uma nova aposta, o usuário **sempre** deve seguir este passo a passo:
  1. Acessar a aba **Lobby** (tela inicial do apostador)
  2. Escolher um bolão disponível (através do código de convite ou da lista de bolões)
  3. Efetuar o pagamento da taxa de inscrição do bolão (caso ainda não tenha pago)
  4. Confirmar o pagamento (homologação)
  5. O usuário é direcionado automaticamente para a aba **Palpites** para realizar os palpites no bolão escolhido
- **Aba "Palpites"**: Esta aba é dedicada à criação e edição de palpites. Aqui o usuário pode escolher o bolão ativo e fazer/editar seus palpites.
- **Aba "Meus Palpites"**: Esta aba exibe o histórico completo do usuário, agrupando os palpites em "Apostas". 
  - **O que é uma Aposta:** Cada vez que o usuário escolhe as 4 seleções (para o bolão de Pódio) ou os placares (para bolões regulares) e o sistema salva, isso é considerado **UMA APOSTA**.
  - **Aposta Finalizada em Bolão de Pódio:** Em bolões do tipo Pódio, o salvamento automático (autosave) é desabilitado. O usuário deve preencher localmente as 4 posições (Campeão, Vice, 3º e 4º). Apenas quando as 4 estiverem preenchidas e houver saldo, o botão **"Finalizar Aposta"** aparecerá. O usuário deve clicar explicitamente nele para registrar e oficializar a aposta no banco de dados. O sistema então exibirá uma mensagem de sucesso confirmando as escolhas.
  - **Saldo em Apostas (1 Pagamento = 1 Aposta):** O pagamento da taxa não libera apostas ilimitadas. O valor pago entra como **Saldo Disponível em Apostas** para aquele bolão específico e é exibido na tela "Lobby" (Dashboard). Esse saldo é deduzido apenas quando uma aposta é finalizada. Caso o usuário pague e não finalize as 4 seleções, o valor permanece como saldo para uso posterior.
  - **Múltiplas Apostas:** O sistema listará "Aposta 1", "Aposta 2", etc., mostrando o conjunto completo em cada bloco.
  - **Fluxo de Nova Aposta a partir do Histórico:** Há um botão "Novo Palpite" na aba "Meus Palpites". Esse botão serve unicamente para redirecionar o usuário para a aba "Palpites", onde o formulário estará **limpo e pronto** para realizar uma **nova aposta** nesse mesmo bolão ou em outro diferente (desde que haja saldo disponível). Ao finalizar, esta nova aposta será salva e aparecerá em "Meus Palpites" como "Aposta 2", e assim por diante.
- **Persistência de Palpites**: Assim que um palpite for concluído e salvo na aba "Palpites", ele automaticamente aparecerá na aba "Meus Palpites".
- **Exibição das Apostas Pagas**: Todo apostador deve visualizar, ao retornar ao sistema ou atualizar a página, os palpites já realizados e pagos na aba "Meus Palpites".
- **Pódio da Copa**: No bolão de pódio, as 4 posições escolhidas (Campeão, Vice, 3º e 4º) devem permanecer visíveis após recarga de página, tanto na aba "Palpites" quanto na aba "Meus Palpites", desde que tenham sido salvas com sucesso.
- **Limite de Apostas por Bolão**: Cada apostador poderá registrar **até 30 apostas** dentro de um mesmo bolão.
- **Vedação de Duplicidade**: Dentro do mesmo bolão, o sistema não deve aceitar duas apostas com palpites idênticos do mesmo apostador.

---

## 5. Divisão Contábil e Regra Contábil de Rateio dos Prêmios

Toda a infraestrutura financeira foi pensada sob regras tributárias de transações esportivas:

1.  **Dedução Administrativa (Taxa da Banca):**
    *   O administrador parametriza no painel a Taxa da Banca (padrão: **20%** em cima de cada taxa de inscrição).
    *   Quando um webhook de confirmação é recebido pelo pagb-webhook, **20% do valor** é retido no saldo direto do Organizador (*Tenant*) para amortizar despesas de gerenciamento e infraestrutura.
    *   Os **80% restantes (Valor Líquido)** alimentam o fundo geral acumulado (*Net Prize Pool*).
2.  **Distribuição dos Resultados (Rateio do Bolão):**
    *   No final da Copa, o fundo acumulado líquido total das inscrições será dividido estritamente de maneira regressiva entre os três melhores do ranking geral:
        *   **1º Lugar:** Ganha **60%** do acumulado total líquido.
        *   **2º Lugar:** Ganha **25%** do acumulado total líquido.
        *   **3º Lugar:** Ganha **15%** do acumulado total líquido.

---

## 6. Painel do Organizador (Admin Workspace e Hold to Confirm)

O organizador possui uma central de comando para pilotar os bolões. Ele acessa três fluxos específicos na guia **Painel Admin**:

1.  **Painel Operacional (Métricas):**
    *   Exibe KPIs acumulados de Faturamento Bruto, Comissões Totais Retidas pela Banca (com explicações em tooltips contextuais) e Solicitações de Resgate/Saque pendentes. Unificado com um gráfico visual de novos inscritos correspondente aos últimos 7 dias.
2.  **Simulador de Atividades (Configuração Contábil):**
    *   Apresenta uma interface que funciona como calculador de projeções.
    *   O administrador pode usar um controle deslizante (*slider*) para ver estimativas dinâmicas de arrecadação de acordo com o crescimento dos inscritos (ex: simulando 180 a 500 apostadores). O painel reconfigura imediatamente o quanto de lucro a banca vai reter e o valor exato aproximado que os três primeiros colocados irão faturar.
3.  **Gestão de Rodadas (Definição de Placar com "Hold to Confirm"):**
    *   Para garantir que o organizador não clique por engano em um placar incorreto e avacalhe os palpites gerais, implementamos uma confirmação por toque persistente de **1.5 segundos (Hold-to-Confirm)**.
    *   O administrador altera o placar do jogo e clica/segura o botão de homologação.
    *   Uma barra de progresso visual se expande (0 a 100%) na cor verde. Se ele soltar antes dos 1.5s, o processo reseta por segurança.
    *   Se mantido até o fim, a transação Postgres atualiza o status do jogo para `finished`, bloqueia novos palpites e de forma imediata recalcula as pontuações e posições ao vivo do ranking dos participantes.

---

## 7. Alertas e Notificações Push (Smartphone Realtime Preview)

Diferente de sistemas comuns, o admin possui um **Editor Push com Visualizador Interno**:
*   O Organizador escolhe um modelo rápido de notificação disponível (Ex: "Gol do Brasil/Acionamento de VAR", "Atualização do Ranking de Líderes" ou "Aviso de Acúmulo de Prêmio").
*   O admin escreve a mensagem customizada e o sistema mostra em tempo real como aquela notificação se comportará na tela de bloqueio do celular de um usuário utilizando um mockup físico de smartphone.
*   Ao despachar, o alerta é propagado aos apostadores e ordenado na guia de e-mails/alertas com bolhas indicativas de leituras pendentes.
