-- Consolidate plans: migrate basic and pro subscribers to premium (now displayed as "Pro")
-- basic and pro users receive an upgrade with no price change until renewal
UPDATE "Subscription"
SET plan = 'premium'
WHERE plan IN ('basic', 'pro')
  AND status = 'active';
