CREATE INDEX IF NOT EXISTS "JobAnalysis_user_profile_created_desc_idx"
ON "JobAnalysis" ("userId", "selectedSubprofileId", "createdAt" DESC);
