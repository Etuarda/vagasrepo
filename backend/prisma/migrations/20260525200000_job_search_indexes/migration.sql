CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Job_titulo_trgm_idx" ON "Job" USING GIN ("titulo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Job_empresa_trgm_idx" ON "Job" USING GIN ("empresa" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Job_fase_trgm_idx" ON "Job" USING GIN ("fase" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Job_userId_data_id_idx" ON "Job" ("userId", "data" DESC, "id" DESC);
