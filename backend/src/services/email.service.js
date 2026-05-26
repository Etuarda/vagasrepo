const env = require("../config/env");
const crypto = require("crypto");
const { Resend } = require("resend");

let resendClient = null;

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

function resetEmailIdempotencyKey(token) {
  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  return `password-reset-${tokenHash}`;
}

function getResendClient() {
  if (!resendClient) resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

function isTestingSender() {
  return /<[^>]*@resend\.dev>|@resend\.dev\b/i.test(env.EMAIL_FROM || "");
}

function canSendWithTestingSender(recipient) {
  return Boolean(env.RESEND_TEST_RECIPIENT)
    && String(recipient || "").trim().toLowerCase() === env.RESEND_TEST_RECIPIENT;
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
  if (env.NODE_ENV === "production" && isTestingSender() && !canSendWithTestingSender(user.email)) {
    const err = new Error("Recuperacao de senha disponivel apenas para o destinatario de teste ate configurar um dominio verificado.");
    err.statusCode = 503;
    throw err;
  }

  const { error } = await getResendClient().emails.send(
    {
      from: env.EMAIL_FROM,
      to: [user.email],
      subject: "Recuperacao de senha - Vagas.io",
      text: `Ola, ${user.name}. Use este link para criar uma nova senha. O link expira em 30 minutos: ${link}`,
      html: `<p>Ola, ${safeName}.</p><p>Use o link abaixo para criar uma nova senha. Ele expira em 30 minutos.</p><p><a href="${safeLink}">Redefinir senha</a></p>`,
    },
    { idempotencyKey: resetEmailIdempotencyKey(token) }
  );

  if (error) {
    const err = new Error("Nao foi possivel enviar o e-mail de recuperacao.");
    err.statusCode = 503;
    throw err;
  }

  return {};
}

module.exports = { sendPasswordResetEmail, resetUrl, resetEmailIdempotencyKey, isTestingSender, canSendWithTestingSender };
