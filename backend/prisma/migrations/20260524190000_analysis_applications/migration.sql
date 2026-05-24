-- Relate candidacies created from deterministic analyses and their generated resumes.
ALTER TABLE "Job"
  ADD COLUMN "jobDescription" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "jobAnalysisId" TEXT,
  ADD COLUMN "optimizedResumeId" TEXT;

CREATE INDEX "Job_jobAnalysisId_idx" ON "Job"("jobAnalysisId");
CREATE INDEX "Job_optimizedResumeId_idx" ON "Job"("optimizedResumeId");

ALTER TABLE "Job" ADD CONSTRAINT "Job_jobAnalysisId_fkey" FOREIGN KEY ("jobAnalysisId") REFERENCES "JobAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_optimizedResumeId_fkey" FOREIGN KEY ("optimizedResumeId") REFERENCES "OptimizedResume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
