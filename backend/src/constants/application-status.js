const JOB_STATUSES = Object.freeze(["Ativa", "Pausada", "Encerrada"]);

const APPLICATION_PHASES = Object.freeze([
  "Currículo gerado",
  "Aplicada",
  "Entrevista",
  "Teste técnico",
  "Feedback",
  "Encerrada",
]);

function normalizeJobStatusAndPhase(data = {}) {
  const normalized = { ...data };
  if (normalized.fase === "Encerrada" || normalized.status === "Encerrada") {
    normalized.fase = "Encerrada";
    normalized.status = "Encerrada";
  }
  return normalized;
}

function isActivePhase(phase) {
  return APPLICATION_PHASES.includes(phase) && phase !== "Encerrada";
}

function assertCanUpdateClosedJob(existing, next) {
  if (!existing || existing.status !== "Encerrada") return;
  const keepsClosed = next.status === "Encerrada" && next.fase === "Encerrada";
  if (keepsClosed) return;
  const err = new Error("Vaga encerrada permite apenas consulta e edição de observações históricas.");
  err.statusCode = 409;
  err.code = "JOB_CLOSED";
  throw err;
}

function phaseToAnalysisStatus(fase) {
  return APPLICATION_PHASES.includes(fase) ? fase : null;
}

module.exports = {
  JOB_STATUSES,
  APPLICATION_PHASES,
  normalizeJobStatusAndPhase,
  assertCanUpdateClosedJob,
  phaseToAnalysisStatus,
  isActivePhase,
};
