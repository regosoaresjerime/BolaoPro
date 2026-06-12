# BolaoPro 2026

Frontend React/Vite para o BolaoPro com persistencia em Supabase e rotinas sensiveis em Supabase Edge Functions.

## Stack

- Frontend: React 19 + TypeScript + Vite
- Banco e autenticacao: Supabase
- Pagamentos: PagBank via Supabase Edge Functions
- CI: GitHub Actions
- Hospedagem do frontend: Vercel

## Requisitos

- Node.js 20+
- npm 10+
- Projeto Supabase configurado

## Ambiente local

1. Instale as dependencias:
   `npm install`
2. Copie o arquivo de exemplo:
   `cp .env.example .env.local`
3. Preencha no minimo:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Inicie o projeto:
   `npm run dev`

## Build local

- Rodar checagem de tipos: `npm run typecheck`
- Gerar build de producao: `npm run build`
- Visualizar build localmente: `npm run preview`

## Deploy na Vercel

1. Publique este projeto em um repositorio no GitHub.
2. Importe o repositorio na Vercel.
3. Confirme as configuracoes detectadas:
   - Framework: `Vite`
   - Install Command: `npm ci`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Configure as variaveis de ambiente da Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `APP_URL` com a URL publica da aplicacao, se voce quiser manter esse valor documentado
5. Faça o deploy.

O arquivo `vercel.json` ja foi incluido para fixar essas definicoes e garantir fallback para `index.html`.

## Deploy do Supabase

O frontend na Vercel depende de recursos publicados no Supabase.

### Banco

- Aplique as migrations do diretorio `supabase/migrations`
- Confirme RLS, tabelas e seeds necessarios antes de abrir producao

### Edge Functions

Configure os secrets abaixo diretamente no Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PAGBANK_TOKEN`
- `PAGBANK_SANDBOX`
- `PAGBANK_PROD_ENABLED`
- `N8N_WEBHOOK_URL` se o fluxo n8n estiver ativo

Publique as funcoes usadas pelo app:

- `pagbank-create-order`
- `pagbank-webhook`
- `pagbank-webhook-test`
- `n8n-create-order`
- `wallet-use-balance`
- `wallet-reclaim-unused-entries`

## GitHub

O repositorio esta preparado para GitHub com:

- `.gitignore` protegendo arquivos de ambiente
- workflow em `.github/workflows/ci.yml`
- build validado com `npm run build`

Fluxo sugerido:

1. Inicialize o repositório Git local:
   `git init -b main`
2. Adicione os arquivos:
   `git add .`
3. Crie o primeiro commit:
   `git commit -m "chore: preparar deploy na vercel"`
4. Conecte ao repositorio remoto no GitHub:
   `git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git`
5. Envie para o GitHub:
   `git push -u origin main`

## Seguranca

- Nao versione `.env`, `.env.local` ou qualquer chave real
- Nao coloque `SUPABASE_SERVICE_ROLE_KEY` na Vercel
- Mantenha tokens do PagBank apenas nos secrets do Supabase
- Revise documentos tecnicos antes de publicar um repositorio publico
