-- Smart Resume Matcher: structured source data, subprofile overlays and versioned analysis.
ALTER TABLE "CareerProfile"
  ADD COLUMN "objective" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE "Skill"
  ADD COLUMN "normalizedName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';

ALTER TABLE "Project"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN "shortDescription" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "businessProblem" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "technicalSolution" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "architecture" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ProjectTechnology"
  ADD COLUMN "normalizedName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';

CREATE TABLE "Education" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "period" TEXT NOT NULL DEFAULT '',
  "userId" TEXT NOT NULL,
  "profileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectBullet" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'backend',
  "content" TEXT NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "weight" INTEGER NOT NULL DEFAULT 50,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectBullet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubprofileSkill" (
  "id" TEXT NOT NULL,
  "subprofileId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "relevanceWeight" INTEGER NOT NULL DEFAULT 50,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SubprofileSkill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubprofileProject" (
  "id" TEXT NOT NULL,
  "subprofileId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "customTitle" TEXT NOT NULL DEFAULT '',
  "customSummary" TEXT NOT NULL DEFAULT '',
  "customBullets" JSONB,
  "relevanceWeight" INTEGER NOT NULL DEFAULT 50,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SubprofileProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubprofileExperience" (
  "id" TEXT NOT NULL,
  "subprofileId" TEXT NOT NULL,
  "experienceId" TEXT NOT NULL,
  "customBullets" JSONB,
  "relevanceWeight" INTEGER NOT NULL DEFAULT 50,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SubprofileExperience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubprofileCourse" (
  "id" TEXT NOT NULL,
  "subprofileId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "relevanceWeight" INTEGER NOT NULL DEFAULT 50,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SubprofileCourse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubprofileCertification" (
  "id" TEXT NOT NULL,
  "subprofileId" TEXT NOT NULL,
  "certificationId" TEXT NOT NULL,
  "relevanceWeight" INTEGER NOT NULL DEFAULT 50,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SubprofileCertification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobAnalysis" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobTitle" TEXT NOT NULL,
  "company" TEXT NOT NULL DEFAULT '',
  "jobDescription" TEXT NOT NULL,
  "selectedSubprofileId" TEXT,
  "matchScore" INTEGER NOT NULL,
  "jobCategory" TEXT NOT NULL DEFAULT 'unknown',
  "matchedSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "missingSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "selectedProjectIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "generatedResumeId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "appliedAt" TIMESTAMP(3),
  "notes" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 1,
  "parentAnalysisId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoogleDocsExport" (
  "id" TEXT NOT NULL,
  "optimizedResumeId" TEXT NOT NULL,
  "googleDocId" TEXT NOT NULL DEFAULT '',
  "googleDocUrl" TEXT NOT NULL DEFAULT '',
  "permissionType" TEXT NOT NULL DEFAULT 'private',
  "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleDocsExport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Education_userId_idx" ON "Education"("userId");
CREATE INDEX "Education_profileId_idx" ON "Education"("profileId");
CREATE INDEX "ProjectBullet_projectId_idx" ON "ProjectBullet"("projectId");
CREATE UNIQUE INDEX "SubprofileSkill_subprofileId_skillId_key" ON "SubprofileSkill"("subprofileId", "skillId");
CREATE INDEX "SubprofileSkill_skillId_idx" ON "SubprofileSkill"("skillId");
CREATE UNIQUE INDEX "SubprofileProject_subprofileId_projectId_key" ON "SubprofileProject"("subprofileId", "projectId");
CREATE INDEX "SubprofileProject_projectId_idx" ON "SubprofileProject"("projectId");
CREATE UNIQUE INDEX "SubprofileExperience_subprofileId_experienceId_key" ON "SubprofileExperience"("subprofileId", "experienceId");
CREATE INDEX "SubprofileExperience_experienceId_idx" ON "SubprofileExperience"("experienceId");
CREATE UNIQUE INDEX "SubprofileCourse_subprofileId_courseId_key" ON "SubprofileCourse"("subprofileId", "courseId");
CREATE INDEX "SubprofileCourse_courseId_idx" ON "SubprofileCourse"("courseId");
CREATE UNIQUE INDEX "SubprofileCertification_subprofileId_certificationId_key" ON "SubprofileCertification"("subprofileId", "certificationId");
CREATE INDEX "SubprofileCertification_certificationId_idx" ON "SubprofileCertification"("certificationId");
CREATE INDEX "JobAnalysis_userId_createdAt_idx" ON "JobAnalysis"("userId", "createdAt");
CREATE INDEX "JobAnalysis_selectedSubprofileId_idx" ON "JobAnalysis"("selectedSubprofileId");
CREATE INDEX "JobAnalysis_status_idx" ON "JobAnalysis"("status");
CREATE INDEX "GoogleDocsExport_optimizedResumeId_idx" ON "GoogleDocsExport"("optimizedResumeId");

ALTER TABLE "Education" ADD CONSTRAINT "Education_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Education" ADD CONSTRAINT "Education_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBullet" ADD CONSTRAINT "ProjectBullet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileSkill" ADD CONSTRAINT "SubprofileSkill_subprofileId_fkey" FOREIGN KEY ("subprofileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileSkill" ADD CONSTRAINT "SubprofileSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileProject" ADD CONSTRAINT "SubprofileProject_subprofileId_fkey" FOREIGN KEY ("subprofileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileProject" ADD CONSTRAINT "SubprofileProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileExperience" ADD CONSTRAINT "SubprofileExperience_subprofileId_fkey" FOREIGN KEY ("subprofileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileExperience" ADD CONSTRAINT "SubprofileExperience_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileCourse" ADD CONSTRAINT "SubprofileCourse_subprofileId_fkey" FOREIGN KEY ("subprofileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileCourse" ADD CONSTRAINT "SubprofileCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileCertification" ADD CONSTRAINT "SubprofileCertification_subprofileId_fkey" FOREIGN KEY ("subprofileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileCertification" ADD CONSTRAINT "SubprofileCertification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_selectedSubprofileId_fkey" FOREIGN KEY ("selectedSubprofileId") REFERENCES "CareerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_generatedResumeId_fkey" FOREIGN KEY ("generatedResumeId") REFERENCES "OptimizedResume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_parentAnalysisId_fkey" FOREIGN KEY ("parentAnalysisId") REFERENCES "JobAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GoogleDocsExport" ADD CONSTRAINT "GoogleDocsExport_optimizedResumeId_fkey" FOREIGN KEY ("optimizedResumeId") REFERENCES "OptimizedResume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing profile data as its structured starting content.
UPDATE "Skill" SET "normalizedName" = lower("name") WHERE "normalizedName" = '';
UPDATE "ProjectTechnology" SET "normalizedName" = lower("name") WHERE "normalizedName" = '';
