async function recordApplicationStatusHistory(db, data) {
  if (!db.applicationStatusHistory?.create) return null;
  if (!data.jobId) return null;
  const changed = data.statusAnterior !== data.novoStatus || data.faseAnterior !== data.novaFase;
  if (!changed && !data.observacao) return null;
  return db.applicationStatusHistory.create({
    data: {
      userId: data.userId,
      jobId: data.jobId,
      statusAnterior: data.statusAnterior || "",
      novoStatus: data.novoStatus || "",
      faseAnterior: data.faseAnterior || "",
      novaFase: data.novaFase || "",
      observacao: data.observacao || "",
    },
  });
}

module.exports = { recordApplicationStatusHistory };
