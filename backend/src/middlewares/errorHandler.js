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
    console.error(JSON.stringify({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      error: err?.message || "Erro interno",
      stack: err?.stack,
    }));
  }
  return res.status(status).json({
    error: message,
    ...(err?.code ? { code: err.code } : {}),
    ...(err?.details ? { details: err.details } : {}),
  });
}

module.exports = { errorHandler };
