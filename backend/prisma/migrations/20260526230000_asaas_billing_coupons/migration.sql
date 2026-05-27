ALTER TABLE "User" ADD COLUMN "cpfCnpj" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Subscription"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerCustomerId" TEXT,
  ADD COLUMN "providerSubscriptionId" TEXT,
  ADD COLUMN "providerPaymentId" TEXT,
  ADD COLUMN "checkoutUrl" TEXT,
  ADD COLUMN "lastPaymentStatus" TEXT,
  ADD COLUMN "pendingPlan" TEXT,
  ADD COLUMN "couponId" TEXT,
  ADD COLUMN "originalPriceCents" INTEGER,
  ADD COLUMN "finalPriceCents" INTEGER,
  ADD COLUMN "discountCents" INTEGER;

CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "userId" TEXT,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "maxDiscountCents" INTEGER,
  "appliesToPlans" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "duration" TEXT NOT NULL DEFAULT 'once',
  "maxRedemptions" INTEGER,
  "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  "maxRedemptionsPerUser" INTEGER DEFAULT 1,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CouponRedemption" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "plan" TEXT NOT NULL,
  "originalPriceCents" INTEGER NOT NULL,
  "discountCents" INTEGER NOT NULL,
  "finalPriceCents" INTEGER NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Subscription_providerCustomerId_idx" ON "Subscription"("providerCustomerId");
CREATE INDEX "Subscription_providerSubscriptionId_idx" ON "Subscription"("providerSubscriptionId");
CREATE INDEX "Subscription_providerPaymentId_idx" ON "Subscription"("providerPaymentId");
CREATE INDEX "Subscription_couponId_idx" ON "Subscription"("couponId");

CREATE UNIQUE INDEX "BillingEvent_provider_eventId_key" ON "BillingEvent"("provider", "eventId");
CREATE INDEX "BillingEvent_userId_idx" ON "BillingEvent"("userId");
CREATE INDEX "BillingEvent_eventType_idx" ON "BillingEvent"("eventType");

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_active_idx" ON "Coupon"("active");
CREATE INDEX "Coupon_expiresAt_idx" ON "Coupon"("expiresAt");

CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");
CREATE INDEX "CouponRedemption_subscriptionId_idx" ON "CouponRedemption"("subscriptionId");
CREATE INDEX "CouponRedemption_couponId_userId_idx" ON "CouponRedemption"("couponId", "userId");
CREATE UNIQUE INDEX "CouponRedemption_couponId_subscriptionId_key" ON "CouponRedemption"("couponId", "subscriptionId");

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
