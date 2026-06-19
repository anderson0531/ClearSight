-- Scale credit balances to integer "credit units" (1 displayed credit = 100 units)
-- so the app can price actions in fractions of a credit (e.g. 0.5-credit
-- re-localization) while keeping integer column semantics.

-- Change the default charge for a base generation from 1 credit to 100 units.
ALTER TABLE "Generation" ALTER COLUMN "creditsCharged" SET DEFAULT 100;

-- Migrate existing balances/ledger from credits to units (multiply by 100).
UPDATE "User" SET "coreTokens" = "coreTokens" * 100;
UPDATE "CreditTransaction" SET "amount" = "amount" * 100, "balanceAfter" = "balanceAfter" * 100;
UPDATE "Generation" SET "creditsCharged" = "creditsCharged" * 100;
