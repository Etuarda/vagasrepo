ALTER TABLE "Project" ADD COLUMN "stack" TEXT NOT NULL DEFAULT '';

CREATE TABLE "SubprofileEducation" (
  "id" TEXT NOT NULL,
  "subprofileId" TEXT NOT NULL,
  "educationId" TEXT NOT NULL,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SubprofileEducation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubprofileLanguage" (
  "id" TEXT NOT NULL,
  "subprofileId" TEXT NOT NULL,
  "languageId" TEXT NOT NULL,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SubprofileLanguage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubprofileEducation_subprofileId_educationId_key" ON "SubprofileEducation"("subprofileId", "educationId");
CREATE INDEX "SubprofileEducation_educationId_idx" ON "SubprofileEducation"("educationId");
CREATE UNIQUE INDEX "SubprofileLanguage_subprofileId_languageId_key" ON "SubprofileLanguage"("subprofileId", "languageId");
CREATE INDEX "SubprofileLanguage_languageId_idx" ON "SubprofileLanguage"("languageId");

ALTER TABLE "SubprofileEducation" ADD CONSTRAINT "SubprofileEducation_subprofileId_fkey" FOREIGN KEY ("subprofileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileEducation" ADD CONSTRAINT "SubprofileEducation_educationId_fkey" FOREIGN KEY ("educationId") REFERENCES "Education"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileLanguage" ADD CONSTRAINT "SubprofileLanguage_subprofileId_fkey" FOREIGN KEY ("subprofileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubprofileLanguage" ADD CONSTRAINT "SubprofileLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SubprofileEducation" ("id", "subprofileId", "educationId", "isVisible")
SELECT md5(subprofile."id" || ':education:' || education."id"), subprofile."id", education."id", true
FROM "CareerProfile" subprofile
JOIN "CareerProfile" global_profile ON global_profile."userId" = subprofile."userId" AND global_profile."isGlobal" = true
JOIN "Education" education ON education."profileId" = global_profile."id"
WHERE subprofile."isGlobal" = false;

INSERT INTO "SubprofileLanguage" ("id", "subprofileId", "languageId", "isVisible")
SELECT md5(subprofile."id" || ':language:' || language."id"), subprofile."id", language."id", true
FROM "CareerProfile" subprofile
JOIN "CareerProfile" global_profile ON global_profile."userId" = subprofile."userId" AND global_profile."isGlobal" = true
JOIN "Language" language ON language."profileId" = global_profile."id"
WHERE subprofile."isGlobal" = false;
