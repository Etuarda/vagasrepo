# Vagas.io - Backend (Node.js + Express + Prisma + Zod)

## Requisitos

- Node.js 20+
- Postgres local ou Neon

## Setup local

1. Instale dependencias:

```bash
npm install
```

2. Crie `.env` a partir de `.env.example` e preencha:

- `DATABASE_URL`: connection string Postgres do Neon com `sslmode=require`.
- `JWT_SECRET`: chave com pelo menos 32 caracteres.
- `CORS_ORIGIN`: origens adicionais permitidas, separadas por virgula. A API ja autoriza `https://gestaodevagas.vercel.app` e previews `https://gestaodevagas-*-eduardas-projects-9a8623c8.vercel.app`.
- `REDIS_URL`: conexao Redis TLS (`rediss://...`) usada para sessoes, rate limiting e cache das telas de perfil, historico e candidaturas.
- `FRONTEND_URL`: URL publica da Vercel usada no link de recuperacao de senha.
- `RESEND_API_KEY`: chave da API Resend usada para enviar a recuperacao de senha.
- `EMAIL_FROM`: remetente de dominio verificado no Resend, por exemplo `Vagas.io <recuperacao@seudominio-verificado.com>`.
- `RESEND_TEST_RECIPIENT`: opcional. Enquanto nao houver dominio, permite usar `Vagas.io <onboarding@resend.dev>` somente para o proprio e-mail autorizado na conta Resend; demais usuarios continuam bloqueados.
- `ASAAS_ENV`: `sandbox` para testes ou `production` para cobrancas reais.
- `ASAAS_API_KEY`: chave privada Asaas, configurada somente no backend/Render.
- `ASAAS_WEBHOOK_TOKEN`: token forte usado para autenticar eventos de pagamento.
- `ASAAS_SUCCESS_URL` e `ASAAS_FAILURE_URL`: URLs do frontend apos pagamento.
- `SLOW_QUERY_MS`: limiar para log estruturado de consultas Prisma lentas; padrao `500`.
- `METRICS_TOKEN`: opcional. Quando configurado, protege `GET /metrics` por header `x-metrics-token` ou query `token`.

3. Rode migrations e gere o client:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

4. Suba a API:

```bash
npm run dev
```

API: `http://localhost:3000`

## Deploy com Neon

1. Crie um projeto no Neon.
2. Copie a connection string Postgres para `DATABASE_URL`.
3. Configure as mesmas variaveis no provedor da API.
4. Use `npm install && npm run prisma:deploy` como build command.
5. Use `npm start` como start command.
6. Configure `CORS_ORIGIN` no Render somente para dominios adicionais ou preview local que precise acessar a API publicada.
7. Crie um Redis gerenciado e configure `REDIS_URL` no Render; sem essa variavel a API usa somente cache local por instancia, sem compartilhar resultados entre replicas ou reinicios.
8. Configure `FRONTEND_URL`, `RESEND_API_KEY` e `EMAIL_FROM` no Render para habilitar o envio de links de recuperacao.
9. Configure `ASAAS_ENV`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_SUCCESS_URL` e `ASAAS_FAILURE_URL` somente no servico backend do Render.
10. No painel Asaas, cadastre o webhook `https://gerenciadorpessoaldevagas.onrender.com/billing/webhooks/asaas?token=SEU_TOKEN_FORTE` para os eventos de pagamento suportados.

O frontend publicado encaminha `/api/*` para a Render. Assim, o navegador recebe a sessao em cookie `HttpOnly`, sem armazenar JWT em `localStorage`. O backend ainda aceita Bearer token durante a transicao de clientes antigos.

O envio de recuperacao usa o SDK oficial `resend`. Para atender todos os usuarios reais, valide um dominio no Resend, configure os registros DNS solicitados pelo provedor e use esse dominio em `EMAIL_FROM`. Sem dominio, configure `EMAIL_FROM` com `onboarding@resend.dev` e `RESEND_TEST_RECIPIENT` para validar a troca de senha apenas com a conta autorizada pelo Resend.

Consultas Prisma acima de `SLOW_QUERY_MS` geram evento estruturado `slow_query` nos logs da Render. Encaminhe esses logs e `/metrics` para sua ferramenta de monitoramento para alertas e historico operacional.

## Endpoints

- `GET /health`
- `GET /ready`; verifica conexao com o banco e informa se o cache esta em `redis_ready`, `local_only` ou `degraded_local`.
- `GET /metrics`; metricas HTTP basicas em formato Prometheus. Em producao, configure `METRICS_TOKEN`.
- `GET /billing/me` autenticado; retorna plano efetivo, funcionalidades e consumo/limites atuais.
- `PUT /billing/customer` autenticado; salva o CPF/CNPJ necessario para cobranca.
- `POST /billing/checkout` autenticado; inicia assinatura paga com `{ "plan": "basic|pro|premium", "couponCode": "OPCIONAL" }`.
- `POST /billing/webhooks/asaas?token=...` publico; recebe eventos validados do Asaas e ativa o plano apenas apos pagamento.
- `POST /auth/register`; cria sempre uma conta `free`; plano pago nunca e aceito no cadastro publico.
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me` autenticado por cookie `HttpOnly` ou Bearer legado
- `GET /jobs` autenticado; filtros: `q`, `status`, `period`, `dateFrom`, `dateTo`, `cursor`, `limit`. Use `cursor` com o ultimo `id` retornado para listas extensas.
- `POST /jobs` autenticado
- `PUT /jobs/:id` autenticado
- `DELETE /jobs/:id` autenticado
- `GET /profile` autenticado
- `GET /profiles` autenticado
- `POST /profiles` autenticado
- `PUT /profile` autenticado
- `PUT /profile/skills` autenticado
- `POST /profile/projects` autenticado
- `DELETE /profile/projects/:id` autenticado
- `POST /profile/experiences` autenticado
- `DELETE /profile/experiences/:id` autenticado
- `POST /profile/courses` autenticado
- `DELETE /profile/courses/:id` autenticado
- `POST /profile/certifications` autenticado
- `DELETE /profile/certifications/:id` autenticado
- `POST /match` autenticado
- `GET /shared-matched-jobs?period=day|week|month` autenticado; retorna cargo, empresa e link das vagas pesquisadas no matching ou cadastradas em acompanhamento, sem identificar usuarios
- `GET /optimized-resumes` autenticado
- `DELETE /optimized-resumes/:id` autenticado
- `GET /resume-files` autenticado
- `POST /resume-files` autenticado e `multipart/form-data` no campo `resume`
- `GET /resume-files/:id/download` autenticado
- `DELETE /resume-files/:id` autenticado

O historico de matching (`JobAnalysis` e PDFs otimizados associados) e permanente em todos os planos. Atingir uma quota impede somente novas acoes; consultas e downloads historicos continuam disponiveis.

Leituras repetidas de perfis e catalogo global, historico de matching, acompanhamento de vagas, arquivos PDF e vagas compartilhadas usam cache local com expiracao e invalidacao automatica apos alteracoes. Com `REDIS_URL` configurado, esse cache tambem e compartilhado entre instancias da API.

O frontend carrega dados das abas conforme a navegacao e utiliza cache temporario apenas para evitar novas esperas. Esse cache nao limita nem expira o historico persistido.

## Planos e limites

- `free`: 3 analises vitalicias, nenhum subperfil, sem acesso a vagas compartilhadas e ate 10 vagas acompanhadas.
- `basic`: 30 analises mensais e ate 2 subperfis.
- `pro`: 100 analises mensais e ate 5 subperfis.
- `premium`: 500 analises mensais e ate 10 subperfis.

As regras de autorizacao ficam centralizadas em `src/services/subscription.service.js`; limites sao aplicados no backend antes de persistir novas acoes. Perfil Global nao e contabilizado como subperfil.

Uploads PDF sao limitados a 3 MB e validados por extensao, MIME e assinatura/trailer do arquivo antes da persistencia. Para escala acima do volume atual, arquivos e PDFs gerados devem migrar do PostgreSQL para object storage e geracao assíncrona em fila.
