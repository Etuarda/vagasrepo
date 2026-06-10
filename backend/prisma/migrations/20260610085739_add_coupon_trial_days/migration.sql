-- DropIndex
DROP INDEX "Job_empresa_trgm_idx";

-- DropIndex
DROP INDEX "Job_fase_trgm_idx";

-- DropIndex
DROP INDEX "Job_titulo_trgm_idx";

-- DropIndex
DROP INDEX "Job_userId_data_id_idx";

-- DropIndex
DROP INDEX "Job_userId_data_idx";

-- AlterTable
ALTER TABLE "CareerProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "trialDays" INTEGER,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CreditPurchase" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JobAnalysis" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProjectBullet" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UsageCounter" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Job_userId_data_idx" ON "Job"("userId", "data");
