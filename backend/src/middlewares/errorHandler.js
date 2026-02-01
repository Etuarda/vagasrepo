function errorHandler(err, req, res, next) {
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

  if (status === 500) console.error(err);
  return res.status(status).json({ error: message });
}

module.exports = { errorHandler };
