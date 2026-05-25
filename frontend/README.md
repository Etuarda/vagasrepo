# Vagas.io - Frontend (HTML + JS)

## Rodando local

Voce pode servir essa pasta com qualquer servidor estatico.

Exemplo:

```bash
python -m http.server 5500
```

Acesse: `http://localhost:5500`

## Configuracao da API

O frontend chama diretamente a API publicada no Render, tanto localmente quanto na Vercel:

```text
https://gerenciadorpessoaldevagas.onrender.com
```

Se o endereco do backend mudar, atualize `src/js/config.js`.

## Deploy na Vercel

1. Importe este repositorio na Vercel.
2. Configure o root directory do projeto como `frontend`.
3. Use framework preset `Other`.
4. Deixe o build command vazio; o projeto e estatico.
5. O `vercel.json` ja define o output directory como `.`.
6. Confirme o healthcheck do backend em `https://gerenciadorpessoaldevagas.onrender.com/health`.
7. Adicione a URL final do frontend da Vercel em `CORS_ORIGIN` no backend do Render.

Como o navegador chama o Render diretamente, o backend deve aceitar as origens local e publicada:

```env
CORS_ORIGIN="http://localhost:5500,https://seu-projeto.vercel.app"
```
