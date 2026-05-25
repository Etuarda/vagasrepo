# Vagas.io - Frontend (HTML + JS)

## Rodando local

Voce pode servir essa pasta com qualquer servidor estatico.

Exemplo:

```bash
python -m http.server 5500
```

Acesse: `http://localhost:5500`

## Configuracao da API

Em desenvolvimento, o frontend chama `http://localhost:3000` diretamente.

Na Vercel, as requisicoes feitas para `/api/*` sao encaminhadas pelo `vercel.json` para a API publicada no Render:

```json
{
  "source": "/api/:path*",
  "destination": "https://gerenciadorpessoaldevagas.onrender.com/:path*"
}
```

Se o endereco do backend mudar, atualize somente o destino desse rewrite.

## Deploy na Vercel

1. Importe este repositorio na Vercel.
2. Configure o root directory do projeto como `frontend`.
3. Use framework preset `Other`.
4. Deixe o build command vazio; o projeto e estatico.
5. O `vercel.json` ja define o output directory como `.`.
6. Confirme o healthcheck do backend em `https://gerenciadorpessoaldevagas.onrender.com/health`.

O acesso publicado passa pelo rewrite `/api`, mantendo as chamadas do navegador no mesmo dominio do frontend. Para uso local direto do backend, mantenha a origem local permitida:

```env
CORS_ORIGIN="http://localhost:5500"
```
