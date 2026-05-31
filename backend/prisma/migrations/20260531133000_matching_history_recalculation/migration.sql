-- Matching history audit and manual recalculation fields
ALTER TABLE "JobAnalysis" ADD COLUMN "jobOrigin" TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE "JobAnalysis" ADD COLUMN "selectedProfileType" TEXT NOT NULL DEFAULT 'global';
ALTER TABLE "JobAnalysis" ADD COLUMN "selectedProfileName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "JobAnalysis" ADD COLUMN "globalScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobAnalysis" ADD COLUMN "globalAnalysisStatus" TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE "JobAnalysis" ADD COLUMN "selectedProfileScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobAnalysis" ADD COLUMN "selectedProjectsSnapshot" JSONB;
ALTER TABLE "JobAnalysis" ADD COLUMN "selectedCoursesSnapshot" JSONB;
ALTER TABLE "JobAnalysis" ADD COLUMN "selectedCertificationsSnapshot" JSONB;
ALTER TABLE "JobAnalysis" ADD COLUMN "analysisStatus" TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE "JobAnalysis" ADD COLUMN "recalculationReason" TEXT NOT NULL DEFAULT 'initial';
ALTER TABLE "JobAnalysis" ADD COLUMN "sourceAnalysisId" TEXT;

CREATE INDEX "JobAnalysis_sourceAnalysisId_idx" ON "JobAnalysis"("sourceAnalysisId");
CREATE INDEX "JobAnalysis_analysisStatus_idx" ON "JobAnalysis"("analysisStatus");
