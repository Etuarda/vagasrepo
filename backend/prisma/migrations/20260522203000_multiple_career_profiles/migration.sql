-- CreateTable
CREATE TABLE "CareerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "emailContact" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "linkedin" TEXT NOT NULL DEFAULT '',
    "github" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerProfile_pkey" PRIMARY KEY ("id")
);

-- AlterTables
ALTER TABLE "Skill" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Project" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Experience" ADD COLUMN "profileId" TEXT;
ALTER TABLE "OptimizedResume" ADD COLUMN "profileId" TEXT;
ALTER TABLE "ResumeFile" ADD COLUMN "profileId" TEXT;

-- Backfill one default profile per existing user.
INSERT INTO "CareerProfile" (
    "id",
    "userId",
    "profileName",
    "name",
    "title",
    "emailContact",
    "phone",
    "location",
    "linkedin",
    "github",
    "summary",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "id",
    'Perfil principal',
    "name",
    COALESCE("title", ''),
    COALESCE("emailContact", ''),
    COALESCE("phone", ''),
    COALESCE("location", ''),
    COALESCE("linkedin", ''),
    COALESCE("github", ''),
    COALESCE("summary", ''),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

UPDATE "Skill" s SET "profileId" = cp."id"
FROM "CareerProfile" cp
WHERE cp."userId" = s."userId" AND cp."profileName" = 'Perfil principal';

UPDATE "Project" p SET "profileId" = cp."id"
FROM "CareerProfile" cp
WHERE cp."userId" = p."userId" AND cp."profileName" = 'Perfil principal';

UPDATE "Experience" e SET "profileId" = cp."id"
FROM "CareerProfile" cp
WHERE cp."userId" = e."userId" AND cp."profileName" = 'Perfil principal';

UPDATE "OptimizedResume" o SET "profileId" = cp."id"
FROM "CareerProfile" cp
WHERE cp."userId" = o."userId" AND cp."profileName" = 'Perfil principal';

UPDATE "ResumeFile" r SET "profileId" = cp."id"
FROM "CareerProfile" cp
WHERE cp."userId" = r."userId" AND cp."profileName" = 'Perfil principal';

-- CreateIndex
CREATE INDEX "CareerProfile_userId_idx" ON "CareerProfile"("userId");
CREATE INDEX "Skill_profileId_idx" ON "Skill"("profileId");
DROP INDEX IF EXISTS "Skill_userId_name_key";
CREATE UNIQUE INDEX "Skill_profileId_name_key" ON "Skill"("profileId", "name");
CREATE INDEX "Project_profileId_idx" ON "Project"("profileId");
CREATE INDEX "Experience_profileId_idx" ON "Experience"("profileId");
CREATE INDEX "OptimizedResume_profileId_idx" ON "OptimizedResume"("profileId");
CREATE INDEX "ResumeFile_profileId_idx" ON "ResumeFile"("profileId");

-- AddForeignKey
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptimizedResume" ADD CONSTRAINT "OptimizedResume_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResumeFile" ADD CONSTRAINT "ResumeFile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
