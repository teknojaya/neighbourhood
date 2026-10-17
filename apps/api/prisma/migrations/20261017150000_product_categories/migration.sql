-- Replace the unused special-purpose role with a generic category role.
-- PostgreSQL renames enum values in place, preserving existing role grants.
ALTER TYPE "PlatformRole" RENAME VALUE 'medicine_partner' TO 'product_category_editor';

-- The abandoned private assistance records are retained for historical data.
-- Renaming avoids a destructive DROP during migration; they are no longer
-- exposed by the application or included in the active Prisma schema.
ALTER TABLE "medicine_cases" RENAME TO "archived_assistance_cases";
ALTER TYPE "MedicineCaseStatus" RENAME TO "ArchivedAssistanceCaseStatus";

-- Preserve old inbox rows while removing links to the retired flow.
UPDATE "notifications"
SET type = 'product_category_updated',
    title = 'Previous category update',
    body = 'A previous category-related update is available in your history.',
    link = NULL
WHERE type = 'medicine_case_updated';
