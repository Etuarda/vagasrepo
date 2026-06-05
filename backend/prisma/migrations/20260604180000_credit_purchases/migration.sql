-- Add creditBalance to Subscription
ALTER TABLE "Subscription" ADD COLUMN "creditBalance" INTEGER NOT NULL DEFAULT 0;

-- Create CreditPurchase table
CREATE TABLE "CreditPurchase" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "asaasChargeId"   TEXT,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "credits"         INTEGER NOT NULL DEFAULT 500,
    "priceCents"      INTEGER NOT NULL DEFAULT 2490,
    "pixQrCodeImage"  TEXT,
    "pixCopyPaste"    TEXT,
    "chargeExpiresAt" TIMESTAMP(3),
    "activatedAt"     TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "CreditPurchase_asaasChargeId_key" ON "CreditPurchase"("asaasChargeId");
CREATE INDEX "CreditPurchase_userId_status_idx" ON "CreditPurchase"("userId", "status");
CREATE INDEX "CreditPurchase_asaasChargeId_idx" ON "CreditPurchase"("asaasChargeId");

-- Foreign key
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
