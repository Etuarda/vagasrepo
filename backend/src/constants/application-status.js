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
  const allowedFields = new Set(["notes"]);
  const comparable = (value) => {
    if (value instanceof Date) return value.getTime();
    if (value === undefined || value === null) return "";
    return value;
  };
  const changedProtectedField = Object.entries(next || {}).some(([field, value]) => {
    if (allowedFields.has(field) || value === undefined) return false;
    return comparable(existing[field]) !== comparable(value);
  });
  const nextStatus = next.status ?? existing.status;
  const nextPhase = next.fase ?? existing.fase;
  const keepsClosed = nextStatus === "Encerrada" && nextPhase === "Encerrada";
  if (keepsClosed && !changedProtectedField) return;
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
