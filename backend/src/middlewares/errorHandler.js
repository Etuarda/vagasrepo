function redactLogValue(value) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[JWT]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ]")
    .replace(/(password|senha|token|cpfCnpj|cpf|cnpj)=([^&\s]+)/gi, "$1=[REDACTED]")
    .slice(0, 1000);
}

function errorHandler(err, req, res, next) {
  if (err?.name === "MulterError") {
    const message = err.code === "LIMIT_FILE_SIZE" ? "O PDF deve ter no maximo 3MB" : "Upload invalido";
    return res.status(400).json({ error: message });
  }

  // Zod validation
  if (err?.name === "ZodError") {
    return res.status(400).json({
      error: "Validação falhou",
      issues: err.issues?.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  // Prisma unique constraint
  if (err?.code === "P2002") {
    return res.status(409).json({ error: "Conflito: valor já existe" });
  }

  const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message = status === 500 ? "Erro interno" : (err?.message || "Erro");

  if (status === 500) {
    const logEntry = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      error: redactLogValue(err?.message || "Erro interno"),
    };
    if (process.env.NODE_ENV !== "production") logEntry.stack = redactLogValue(err?.stack);
    console.error(JSON.stringify(logEntry));
  }
  return res.status(status).json({
    error: message,
    ...(err?.code ? { code: err.code } : {}),
    ...(err?.details ? { details: err.details } : {}),
  });
}

module.exports = { errorHandler, redactLogValue };
