-- AlterTable
ALTER TABLE "User" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "emailContact" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "location" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "linkedin" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "github" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "summary" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTechnology" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectTechnology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizedResume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetTitle" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "suggestedSummary" TEXT NOT NULL,
    "selectedProjects" JSONB NOT NULL,
    "matchedSkills" TEXT[],
    "missingSkills" TEXT[],
    "matchedTechnologies" TEXT[],
    "missingTechnologies" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptimizedResume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Skill_userId_idx" ON "Skill"("userId");
CREATE UNIQUE INDEX "Skill_userId_name_key" ON "Skill"("userId", "name");
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "ProjectTechnology_projectId_idx" ON "ProjectTechnology"("projectId");
CREATE UNIQUE INDEX "ProjectTechnology_projectId_name_key" ON "ProjectTechnology"("projectId", "name");
CREATE INDEX "Experience_userId_idx" ON "Experience"("userId");
CREATE INDEX "OptimizedResume_userId_idx" ON "OptimizedResume"("userId");
CREATE INDEX "OptimizedResume_createdAt_idx" ON "OptimizedResume"("createdAt");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectTechnology" ADD CONSTRAINT "ProjectTechnology_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptimizedResume" ADD CONSTRAINT "OptimizedResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
