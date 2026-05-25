CREATE TABLE "SharedMatchedJob" (
  "id" TEXT NOT NULL,
  "jobTitle" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "jobUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SharedMatchedJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SharedMatchedJob_createdAt_idx" ON "SharedMatchedJob"("createdAt");
CREATE INDEX "SharedMatchedJob_jobTitle_idx" ON "SharedMatchedJob"("jobTitle");
CREATE INDEX "SharedMatchedJob_company_idx" ON "SharedMatchedJob"("company");

INSERT INTO "SharedMatchedJob" ("id", "jobTitle", "company", "jobUrl", "createdAt")
SELECT
  "id",
  "jobTitle",
  "company",
  "jobUrl",
  "createdAt"
FROM "JobAnalysis"
WHERE "version" = 1
  AND trim("jobTitle") <> ''
  AND trim("company") <> ''
  AND trim("jobUrl") <> '';
