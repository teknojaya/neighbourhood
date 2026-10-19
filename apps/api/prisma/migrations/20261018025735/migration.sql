/*
  Warnings:

  - You are about to drop the `archived_assistance_cases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `partner_organization_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `partner_organizations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "archived_assistance_cases" DROP CONSTRAINT "medicine_cases_partner_org_id_fkey";

-- DropForeignKey
ALTER TABLE "archived_assistance_cases" DROP CONSTRAINT "medicine_cases_requester_id_fkey";

-- DropForeignKey
ALTER TABLE "partner_organization_members" DROP CONSTRAINT "partner_organization_members_org_id_fkey";

-- DropForeignKey
ALTER TABLE "partner_organization_members" DROP CONSTRAINT "partner_organization_members_user_id_fkey";

-- DropTable
DROP TABLE "archived_assistance_cases";

-- DropTable
DROP TABLE "partner_organization_members";

-- DropTable
DROP TABLE "partner_organizations";

-- DropEnum
DROP TYPE "ArchivedAssistanceCaseStatus";

-- DropEnum
DROP TYPE "ContactPreference";
