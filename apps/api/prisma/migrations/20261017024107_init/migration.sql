-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('staff', 'medicine_partner');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('member', 'volunteer', 'moderator');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('pending', 'active', 'removed');

-- CreateEnum
CREATE TYPE "JoinPolicy" AS ENUM ('open', 'approval_required');

-- CreateEnum
CREATE TYPE "UiLanguage" AS ENUM ('en', 'id');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('groceries', 'clothing', 'books', 'household', 'appliances', 'mobility_aids');

-- CreateEnum
CREATE TYPE "ListingMode" AS ENUM ('donate', 'lend');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('new', 'like_new', 'good', 'fair', 'needs_repair');

-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('owner_location', 'community_point');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'active', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "DonationRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'collected', 'expired');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'checked_out', 'returned');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('proposed', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "StockAdjustmentReason" AS ENUM ('deposit_accepted', 'collected', 'damaged', 'expired', 'correction');

-- CreateEnum
CREATE TYPE "PointKind" AS ENUM ('box', 'pantry', 'shelf', 'partner_desk');

-- CreateEnum
CREATE TYPE "MedicineCaseStatus" AS ENUM ('submitted', 'under_review', 'referred', 'closed', 'withdrawn');

-- CreateEnum
CREATE TYPE "ContactPreference" AS ENUM ('in_app', 'phone');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "display_name" VARCHAR(60),
    "area_label" VARCHAR(120),
    "preferred_language" "UiLanguage" NOT NULL DEFAULT 'en',
    "home_lat" DOUBLE PRECISION,
    "home_lng" DOUBLE PRECISION,
    "search_radius_km" INTEGER NOT NULL DEFAULT 3,
    "disabled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "granted_by_id" UUID,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "email_otp_challenges" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(1000) NOT NULL DEFAULT '',
    "area_label" VARCHAR(120) NOT NULL,
    "join_policy" "JoinPolicy" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_memberships" (
    "community_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'member',
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "granted_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "community_memberships_pkey" PRIMARY KEY ("community_id","user_id")
);

-- CreateTable
CREATE TABLE "community_points" (
    "id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "kind" "PointKind" NOT NULL,
    "partner_name" VARCHAR(120) NOT NULL,
    "exact_address" VARCHAR(300) NOT NULL,
    "public_address_consent" BOOLEAN NOT NULL DEFAULT false,
    "consented_by" VARCHAR(120),
    "consented_at" TIMESTAMPTZ(3),
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "geohash" VARCHAR(12) NOT NULL,
    "area_label" VARCHAR(120) NOT NULL,
    "opening_hours" VARCHAR(300),
    "qr_id" VARCHAR(64) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_inventory_items" (
    "id" UUID NOT NULL,
    "point_id" UUID NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "available" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "best_before" DATE,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "point_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" UUID NOT NULL,
    "point_id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "items" JSONB NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'proposed',
    "reviewed_by_id" UUID,
    "review_note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(3),

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "point_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "StockAdjustmentReason" NOT NULL,
    "actor_id" UUID NOT NULL,
    "deposit_id" UUID,
    "request_id" UUID,
    "note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "mode" "ListingMode" NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "condition" "ItemCondition" NOT NULL,
    "stock_total" INTEGER NOT NULL,
    "stock_reserved" INTEGER NOT NULL DEFAULT 0,
    "stock_collected" INTEGER NOT NULL DEFAULT 0,
    "area_label" VARCHAR(120) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "geohash" VARCHAR(12) NOT NULL,
    "collection_method" "CollectionMethod" NOT NULL,
    "community_point_id" UUID,
    "appliance" JSONB,
    "max_loan_days" INTEGER,
    "lending_notes" VARCHAR(500),
    "best_before" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_private" (
    "listing_id" UUID NOT NULL,
    "pickup_instructions" VARCHAR(1000) NOT NULL,
    "contact_note" VARCHAR(300),

    CONSTRAINT "listing_private_pkey" PRIMARY KEY ("listing_id")
);

-- CreateTable
CREATE TABLE "listing_photos" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "storage_path" VARCHAR(300) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_requests" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "message" VARCHAR(500) NOT NULL DEFAULT '',
    "status" "DonationRequestStatus" NOT NULL DEFAULT 'pending',
    "pickup_by" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "donation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'pending',
    "checked_out_at" TIMESTAMPTZ(3),
    "returned_at" TIMESTAMPTZ(3),
    "return_condition_note" VARCHAR(500),
    "message" VARCHAR(500) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "donation_request_id" UUID,
    "loan_id" UUID,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "last_message_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_at" TIMESTAMPTZ(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(300) NOT NULL,
    "link" VARCHAR(200),
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(4096) NOT NULL,
    "platform" VARCHAR(10) NOT NULL DEFAULT 'web',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "needs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "extraction" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "verified_at" TIMESTAMPTZ(3),

    CONSTRAINT "partner_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_organization_members" (
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "partner_organization_members_pkey" PRIMARY KEY ("org_id","user_id")
);

-- CreateTable
CREATE TABLE "medicine_cases" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "status" "MedicineCaseStatus" NOT NULL DEFAULT 'submitted',
    "partner_org_id" UUID,
    "summary" VARCHAR(1000) NOT NULL,
    "has_prescription" BOOLEAN,
    "preferred_contact" "ContactPreference" NOT NULL,
    "consented_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "medicine_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "user_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "email_otp_challenges_email_created_at_idx" ON "email_otp_challenges"("email", "created_at");

-- CreateIndex
CREATE INDEX "community_memberships_user_id_status_idx" ON "community_memberships"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "community_points_qr_id_key" ON "community_points"("qr_id");

-- CreateIndex
CREATE INDEX "community_points_active_geohash_idx" ON "community_points"("active", "geohash");

-- CreateIndex
CREATE INDEX "deposits_point_id_status_idx" ON "deposits"("point_id", "status");

-- CreateIndex
CREATE INDEX "stock_adjustments_point_id_created_at_idx" ON "stock_adjustments"("point_id", "created_at");

-- CreateIndex
CREATE INDEX "listings_status_geohash_idx" ON "listings"("status", "geohash");

-- CreateIndex
CREATE INDEX "listings_owner_id_updated_at_idx" ON "listings"("owner_id", "updated_at");

-- CreateIndex
CREATE INDEX "listing_photos_listing_id_position_idx" ON "listing_photos"("listing_id", "position");

-- CreateIndex
CREATE INDEX "donation_requests_owner_id_created_at_idx" ON "donation_requests"("owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "donation_requests_requester_id_created_at_idx" ON "donation_requests"("requester_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "donation_requests_status_pickup_by_idx" ON "donation_requests"("status", "pickup_by");

-- CreateIndex
CREATE INDEX "loans_listing_id_status_idx" ON "loans"("listing_id", "status");

-- CreateIndex
CREATE INDEX "loans_owner_id_created_at_idx" ON "loans"("owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loans_borrower_id_created_at_idx" ON "loans"("borrower_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_donation_request_id_key" ON "conversations"("donation_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_loan_id_key" ON "conversations"("loan_id");

-- CreateIndex
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_id_idx" ON "messages"("conversation_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE INDEX "needs_user_id_created_at_idx" ON "needs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "medicine_cases_partner_org_id_status_created_at_idx" ON "medicine_cases"("partner_org_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_points" ADD CONSTRAINT "community_points_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_inventory_items" ADD CONSTRAINT "point_inventory_items_point_id_fkey" FOREIGN KEY ("point_id") REFERENCES "community_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_point_id_fkey" FOREIGN KEY ("point_id") REFERENCES "community_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_point_id_fkey" FOREIGN KEY ("point_id") REFERENCES "community_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "point_inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "deposits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_community_point_id_fkey" FOREIGN KEY ("community_point_id") REFERENCES "community_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_private" ADD CONSTRAINT "listing_private_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_requests" ADD CONSTRAINT "donation_requests_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_requests" ADD CONSTRAINT "donation_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_requests" ADD CONSTRAINT "donation_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_donation_request_id_fkey" FOREIGN KEY ("donation_request_id") REFERENCES "donation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "needs" ADD CONSTRAINT "needs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_organization_members" ADD CONSTRAINT "partner_organization_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "partner_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_organization_members" ADD CONSTRAINT "partner_organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_cases" ADD CONSTRAINT "medicine_cases_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_cases" ADD CONSTRAINT "medicine_cases_partner_org_id_fkey" FOREIGN KEY ("partner_org_id") REFERENCES "partner_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ======================================================================
-- Integrity rules Prisma cannot express. These are the database-level
-- backstop for the service rules in packages/shared/src/domain.
-- ======================================================================

-- Emails are compared case-insensitively; one user per email.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "users" ADD CONSTRAINT "users_search_radius_km" CHECK ("search_radius_km" IN (1, 3, 5, 10));
ALTER TABLE "users" ADD CONSTRAINT "users_home_location_pair"
  CHECK (("home_lat" IS NULL) = ("home_lng" IS NULL));
ALTER TABLE "email_otp_challenges" ADD CONSTRAINT "email_otp_email_lowercase" CHECK ("email" = lower("email"));

-- Listing stock accounting: available = total - reserved - collected >= 0.
ALTER TABLE "listings" ADD CONSTRAINT "listings_stock_nonnegative"
  CHECK ("stock_total" >= 0 AND "stock_reserved" >= 0 AND "stock_collected" >= 0);
ALTER TABLE "listings" ADD CONSTRAINT "listings_stock_within_total"
  CHECK ("stock_reserved" + "stock_collected" <= "stock_total");
-- Lending is single-unit.
ALTER TABLE "listings" ADD CONSTRAINT "listings_lend_single_unit"
  CHECK ("mode" <> 'lend' OR ("stock_total" = 1 AND "max_loan_days" IS NOT NULL));
ALTER TABLE "listings" ADD CONSTRAINT "listings_collection_point"
  CHECK (("collection_method" = 'community_point') = ("community_point_id" IS NOT NULL));
ALTER TABLE "listings" ADD CONSTRAINT "listings_coordinates"
  CHECK ("lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180);
-- Geohash range scans use byte-wise ordering.
CREATE INDEX "listings_active_geohash_pattern" ON "listings" ("geohash" text_pattern_ops) WHERE "status" = 'active';

ALTER TABLE "point_inventory_items" ADD CONSTRAINT "point_inventory_nonnegative"
  CHECK ("available" >= 0 AND "reserved" >= 0);

-- Donation requests: no self-requests, positive quantity, one active
-- (pending/approved) request per requester per listing.
ALTER TABLE "donation_requests" ADD CONSTRAINT "donation_requests_not_self" CHECK ("requester_id" <> "owner_id");
ALTER TABLE "donation_requests" ADD CONSTRAINT "donation_requests_quantity" CHECK ("quantity" > 0);
CREATE UNIQUE INDEX "donation_requests_one_active_per_requester"
  ON "donation_requests" ("listing_id", "requester_id")
  WHERE "status" IN ('pending', 'approved');

-- Loans: no self-loans, valid range, and no two blocking loans overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "loans" ADD CONSTRAINT "loans_not_self" CHECK ("borrower_id" <> "owner_id");
ALTER TABLE "loans" ADD CONSTRAINT "loans_valid_range" CHECK ("end_date" >= "start_date");
ALTER TABLE "loans" ADD CONSTRAINT "loans_no_overlap"
  EXCLUDE USING gist ("listing_id" WITH =, daterange("start_date", "end_date", '[]') WITH &&)
  WHERE ("status" IN ('approved', 'checked_out'));

-- Conversations belong to exactly one request or loan.
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_one_subject"
  CHECK (num_nonnulls("donation_request_id", "loan_id") = 1);
ALTER TABLE "messages" ADD CONSTRAINT "messages_body_not_blank" CHECK (length(btrim("body")) > 0);
