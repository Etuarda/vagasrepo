ALTER TABLE "OptimizedResume" ALTER COLUMN "matchedSkills" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "OptimizedResume" ALTER COLUMN "missingSkills" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "OptimizedResume" ALTER COLUMN "matchedTechnologies" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "OptimizedResume" ALTER COLUMN "missingTechnologies" SET DEFAULT ARRAY[]::TEXT[];

UPDATE "OptimizedResume" SET "matchedSkills" = ARRAY[]::TEXT[] WHERE "matchedSkills" IS NULL;
UPDATE "OptimizedResume" SET "missingSkills" = ARRAY[]::TEXT[] WHERE "missingSkills" IS NULL;
UPDATE "OptimizedResume" SET "matchedTechnologies" = ARRAY[]::TEXT[] WHERE "matchedTechnologies" IS NULL;
UPDATE "OptimizedResume" SET "missingTechnologies" = ARRAY[]::TEXT[] WHERE "missingTechnologies" IS NULL;

ALTER TABLE "OptimizedResume" ALTER COLUMN "matchedSkills" SET NOT NULL;
ALTER TABLE "OptimizedResume" ALTER COLUMN "missingSkills" SET NOT NULL;
ALTER TABLE "OptimizedResume" ALTER COLUMN "matchedTechnologies" SET NOT NULL;
ALTER TABLE "OptimizedResume" ALTER COLUMN "missingTechnologies" SET NOT NULL;
