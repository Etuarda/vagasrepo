-- Application status audit trail
CREATE TABLE "ApplicationStatusHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "statusAnterior" TEXT NOT NULL DEFAULT '',
  "novoStatus" TEXT NOT NULL DEFAULT '',
  "faseAnterior" TEXT NOT NULL DEFAULT '',
  "novaFase" TEXT NOT NULL DEFAULT '',
  "observacao" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApplicationStatusHistory_userId_idx" ON "ApplicationStatusHistory"("userId");
CREATE INDEX "ApplicationStatusHistory_jobId_idx" ON "ApplicationStatusHistory"("jobId");
CREATE INDEX "ApplicationStatusHistory_createdAt_idx" ON "ApplicationStatusHistory"("createdAt");

ALTER TABLE "ApplicationStatusHistory"
  ADD CONSTRAINT "ApplicationStatusHistory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationStatusHistory"
  ADD CONSTRAINT "ApplicationStatusHistory_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deterministic matching audit fields
ALTER TABLE "JobAnalysis" ADD COLUMN "extraRelevantSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "JobAnalysis" ADD COLUMN "selectedCourseIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "JobAnalysis" ADD COLUMN "selectedCertificationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "JobAnalysis" ADD COLUMN "confirmedSeniority" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "JobAnalysis" ADD COLUMN "inferredSeniority" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "JobAnalysis" ADD COLUMN "aderenciaBase" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobAnalysis" ADD COLUMN "aderenciaFinal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobAnalysis" ADD COLUMN "skillsScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobAnalysis" ADD COLUMN "projectsScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobAnalysis" ADD COLUMN "seniorityPenalty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobAnalysis" ADD COLUMN "warnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "JobAnalysis" ADD COLUMN "scoringVersion" TEXT NOT NULL DEFAULT 'deterministic-v1';

ALTER TABLE "SharedMatchedJob" ADD COLUMN "confirmedSeniority" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "SharedMatchedJob" ADD COLUMN "inferredSeniority" TEXT NOT NULL DEFAULT 'unknown';
