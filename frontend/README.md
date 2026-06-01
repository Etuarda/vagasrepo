# Vagas.io - Frontend (HTML + JS)

## Rodando local

Voce pode servir essa pasta com qualquer servidor estatico.

Ao alterar classes utilitarias no HTML ou JavaScript, gere o CSS de producao:

```bash
npm install
npm run build:css
```

Exemplo:

```bash
python -m http.server 5500
```

Acesse: `http://localhost:5500`

## Configuracao da API

Na Vercel, o frontend chama `/api`, que e encaminhado para a API da Render pelo `vercel.json`. Isso permite sessao em cookie `HttpOnly`.

```text
/api -> https://gerenciadorpessoaldevagas.onrender.com
```

Em desenvolvimento servido diretamente por `localhost`, `src/js/config.js` usa a API publicada. Para testar o comportamento de cookie de producao e os headers CSP, execute pelo ambiente da Vercel.

O backend atual nao devolve token ao JavaScript. A autenticacao do navegador opera por cookie `HttpOnly` com `credentials: "include"` nas chamadas da API.

## Deploy na Vercel

1. Importe este repositorio na Vercel.
2. Configure o root directory do projeto como `frontend`.
3. Use framework preset `Other`.
4. Deixe o build command vazio; o projeto e estatico e `src/styles/tailwind.css` ja e versionado.
5. O `vercel.json` ja define o output directory como `.`.
6. Confirme o healthcheck do backend em `https://gerenciadorpessoaldevagas.onrender.com/health`.
7. O backend ja permite o dominio `gestaodevagas.vercel.app` e previews deste projeto na equipe Vercel configurada.
8. O `vercel.json` configura proxy `/api`, CSP, HSTS e demais headers de seguranca.

Como o navegador chama o Render diretamente, use `CORS_ORIGIN` no backend apenas para origens adicionais, como o preview local:

```env
CORS_ORIGIN="http://localhost:5500"
```
