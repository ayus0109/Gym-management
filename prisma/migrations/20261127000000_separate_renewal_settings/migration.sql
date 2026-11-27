ALTER TABLE "IntegrationSettings" ADD COLUMN "upiId" TEXT, ADD COLUMN "renewalTemplate" TEXT;
UPDATE "IntegrationSettings" SET "upiId" = "whatsappBusinessAccountId", "whatsappBusinessAccountId" = NULL WHERE "whatsappBusinessAccountId" LIKE '%@%';
UPDATE "IntegrationSettings" SET "renewalTemplate" = "whatsappTemplateName", "whatsappTemplateName" = NULL WHERE "whatsappTemplateName" !~ '^[a-z0-9_]+$';
