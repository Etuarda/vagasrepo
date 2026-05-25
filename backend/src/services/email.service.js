const env = require("../config/env");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetUrl(token) {
  const url = new URL(env.FRONTEND_URL);
  url.searchParams.set("resetToken", token);
  return url.toString();
}

async function sendPasswordResetEmail(user, token) {
  const link = resetUrl(token);
  const safeName = escapeHtml(user.name);
  const safeLink = escapeHtml(link);

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (env.NODE_ENV !== "production") return { previewUrl: link };
    const err = new Error("Recuperacao de senha indisponivel. Configure o envio de e-mail.");
    err.statusCode = 503;
    throw err;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [user.email],
      subject: "Recuperacao de senha - Vagas.io",
      text: `Ola, ${user.name}. Use este link para criar uma nova senha. O link expira em 30 minutos: ${link}`,
      html: `<p>Ola, ${safeName}.</p><p>Use o link abaixo para criar uma nova senha. Ele expira em 30 minutos.</p><p><a href="${safeLink}">Redefinir senha</a></p>`,
    }),
  });

  if (!response.ok) {
    const err = new Error("Nao foi possivel enviar o e-mail de recuperacao.");
    err.statusCode = 503;
    throw err;
  }

  return {};
}

module.exports = { sendPasswordResetEmail, resetUrl };
