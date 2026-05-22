# Vagas.io - Frontend (HTML + JS)

## Rodando local

Voce pode servir essa pasta com qualquer servidor estatico.

Exemplo:

```bash
python -m http.server 5500
```

Acesse: `http://localhost:5500`

## Configuracao da API

Edite `src/js/config.js` para apontar para a URL publica da API.

## Deploy na Vercel

1. Importe este repositorio na Vercel.
2. Configure o root directory do projeto como `frontend`.
3. Use framework preset `Other`.
4. Deixe build command vazio.
5. Deixe output directory vazio ou `.`.
6. Depois do primeiro deploy, copie a URL final da Vercel e adicione no backend em `CORS_ORIGIN`.

Exemplo de `CORS_ORIGIN` no backend:

```env
CORS_ORIGIN="http://localhost:5500,https://seu-projeto.vercel.app"
```
