--
-- PostgreSQL database dump
--

\restrict Dr220FrJtJY99nKvz0J44YuoqpDv9HrbLIaGfZXb2LNVnRqRnv1TkpKJ48NI70x

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: CollectionMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CollectionMethod" AS ENUM (
    'owner_location',
    'community_point'
);


--
-- Name: CommunityRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CommunityRole" AS ENUM (
    'member',
    'volunteer',
    'moderator'
);


--
-- Name: ContactPreference; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ContactPreference" AS ENUM (
    'in_app',
    'phone'
);


--
-- Name: DepositStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DepositStatus" AS ENUM (
    'proposed',
    'accepted',
    'rejected'
);


--
-- Name: DonationRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DonationRequestStatus" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'collected',
    'expired'
);


--
-- Name: ItemCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ItemCategory" AS ENUM (
    'groceries',
    'clothing',
    'books',
    'household',
    'appliances',
    'mobility_aids'
);


--
-- Name: ItemCondition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ItemCondition" AS ENUM (
    'new',
    'like_new',
    'good',
    'fair',
    'needs_repair'
);


--
-- Name: JoinPolicy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."JoinPolicy" AS ENUM (
    'open',
    'approval_required'
);


--
-- Name: ListingMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ListingMode" AS ENUM (
    'donate',
    'lend'
);


--
-- Name: ListingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ListingStatus" AS ENUM (
    'draft',
    'active',
    'paused',
    'closed'
);


--
-- Name: LoanStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoanStatus" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'checked_out',
    'returned'
);


--
-- Name: MedicineCaseStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MedicineCaseStatus" AS ENUM (
    'submitted',
    'under_review',
    'referred',
    'closed',
    'withdrawn'
);


--
-- Name: MembershipStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MembershipStatus" AS ENUM (
    'pending',
    'active',
    'removed'
);


--
-- Name: PlatformRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlatformRole" AS ENUM (
    'staff',
    'medicine_partner'
);


--
-- Name: PointKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PointKind" AS ENUM (
    'box',
    'pantry',
    'shelf',
    'partner_desk'
);


--
-- Name: StockAdjustmentReason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockAdjustmentReason" AS ENUM (
    'deposit_accepted',
    'collected',
    'damaged',
    'expired',
    'correction'
);


--
-- Name: UiLanguage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UiLanguage" AS ENUM (
    'en',
    'id'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: communities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communities (
    id uuid NOT NULL,
    name character varying(80) NOT NULL,
    description character varying(1000) DEFAULT ''::character varying NOT NULL,
    area_label character varying(120) NOT NULL,
    join_policy public."JoinPolicy" DEFAULT 'open'::public."JoinPolicy" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: community_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_memberships (
    community_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public."CommunityRole" DEFAULT 'member'::public."CommunityRole" NOT NULL,
    status public."MembershipStatus" DEFAULT 'active'::public."MembershipStatus" NOT NULL,
    granted_by_id uuid,
    updated_at timestamp(3) with time zone NOT NULL
);


--
-- Name: community_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_points (
    id uuid NOT NULL,
    community_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    kind public."PointKind" NOT NULL,
    partner_name character varying(120) NOT NULL,
    exact_address character varying(300) NOT NULL,
    public_address_consent boolean DEFAULT false NOT NULL,
    consented_by character varying(120),
    consented_at timestamp(3) with time zone,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    geohash character varying(12) NOT NULL,
    area_label character varying(120) NOT NULL,
    opening_hours character varying(300),
    qr_id character varying(64) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp(3) with time zone
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid NOT NULL,
    donation_request_id uuid,
    loan_id uuid,
    closed boolean DEFAULT false NOT NULL,
    last_message_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT conversations_one_subject CHECK ((num_nonnulls(donation_request_id, loan_id) = 1))
);


--
-- Name: deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deposits (
    id uuid NOT NULL,
    point_id uuid NOT NULL,
    donor_id uuid NOT NULL,
    items jsonb NOT NULL,
    status public."DepositStatus" DEFAULT 'proposed'::public."DepositStatus" NOT NULL,
    reviewed_by_id uuid,
    review_note character varying(300),
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reviewed_at timestamp(3) with time zone
);


--
-- Name: donation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donation_requests (
    id uuid NOT NULL,
    listing_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    quantity integer NOT NULL,
    message character varying(500) DEFAULT ''::character varying NOT NULL,
    status public."DonationRequestStatus" DEFAULT 'pending'::public."DonationRequestStatus" NOT NULL,
    pickup_by timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT donation_requests_not_self CHECK ((requester_id <> owner_id)),
    CONSTRAINT donation_requests_quantity CHECK ((quantity > 0))
);


--
-- Name: email_otp_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_otp_challenges (
    id uuid NOT NULL,
    email text NOT NULL,
    code_hash text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    consumed_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT email_otp_email_lowercase CHECK ((email = lower(email)))
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    user_id uuid NOT NULL,
    key character varying(128) NOT NULL,
    request_hash character varying(64) NOT NULL,
    response_status integer NOT NULL,
    response_body jsonb NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: listing_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_photos (
    id uuid NOT NULL,
    listing_id uuid NOT NULL,
    storage_path character varying(300) NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: listing_private; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_private (
    listing_id uuid NOT NULL,
    pickup_instructions character varying(1000) NOT NULL,
    contact_note character varying(300)
);


--
-- Name: listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listings (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    status public."ListingStatus" DEFAULT 'draft'::public."ListingStatus" NOT NULL,
    mode public."ListingMode" NOT NULL,
    category public."ItemCategory" NOT NULL,
    title character varying(100) NOT NULL,
    description character varying(2000) DEFAULT ''::character varying NOT NULL,
    condition public."ItemCondition" NOT NULL,
    stock_total integer NOT NULL,
    stock_reserved integer DEFAULT 0 NOT NULL,
    stock_collected integer DEFAULT 0 NOT NULL,
    area_label character varying(120) NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    geohash character varying(12) NOT NULL,
    collection_method public."CollectionMethod" NOT NULL,
    community_point_id uuid,
    appliance jsonb,
    max_loan_days integer,
    lending_notes character varying(500),
    best_before date,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT listings_collection_point CHECK (((collection_method = 'community_point'::public."CollectionMethod") = (community_point_id IS NOT NULL))),
    CONSTRAINT listings_coordinates CHECK ((((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)) AND ((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)))),
    CONSTRAINT listings_lend_single_unit CHECK (((mode <> 'lend'::public."ListingMode") OR ((stock_total = 1) AND (max_loan_days IS NOT NULL)))),
    CONSTRAINT listings_stock_nonnegative CHECK (((stock_total >= 0) AND (stock_reserved >= 0) AND (stock_collected >= 0))),
    CONSTRAINT listings_stock_within_total CHECK (((stock_reserved + stock_collected) <= stock_total))
);


--
-- Name: loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loans (
    id uuid NOT NULL,
    listing_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    borrower_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status public."LoanStatus" DEFAULT 'pending'::public."LoanStatus" NOT NULL,
    checked_out_at timestamp(3) with time zone,
    returned_at timestamp(3) with time zone,
    return_condition_note character varying(500),
    message character varying(500) DEFAULT ''::character varying NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT loans_not_self CHECK ((borrower_id <> owner_id)),
    CONSTRAINT loans_valid_range CHECK ((end_date >= start_date))
);


--
-- Name: medicine_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medicine_cases (
    id uuid NOT NULL,
    requester_id uuid NOT NULL,
    status public."MedicineCaseStatus" DEFAULT 'submitted'::public."MedicineCaseStatus" NOT NULL,
    partner_org_id uuid,
    summary character varying(1000) NOT NULL,
    has_prescription boolean,
    preferred_contact public."ContactPreference" NOT NULL,
    consented_at timestamp(3) with time zone NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body character varying(2000) NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT messages_body_not_blank CHECK ((length(btrim((body)::text)) > 0))
);


--
-- Name: needs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.needs (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    extraction jsonb NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type character varying(40) NOT NULL,
    title character varying(120) NOT NULL,
    body character varying(300) NOT NULL,
    link character varying(200),
    read_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: partner_organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_organization_members (
    org_id uuid NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: partner_organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_organizations (
    id uuid NOT NULL,
    name character varying(120) NOT NULL,
    verified_at timestamp(3) with time zone
);


--
-- Name: point_inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_inventory_items (
    id uuid NOT NULL,
    point_id uuid NOT NULL,
    category public."ItemCategory" NOT NULL,
    title character varying(100) NOT NULL,
    available integer DEFAULT 0 NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    best_before date,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT point_inventory_nonnegative CHECK (((available >= 0) AND (reserved >= 0)))
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token character varying(4096) NOT NULL,
    platform character varying(10) DEFAULT 'web'::character varying NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustments (
    id uuid NOT NULL,
    point_id uuid NOT NULL,
    item_id uuid NOT NULL,
    delta integer NOT NULL,
    reason public."StockAdjustmentReason" NOT NULL,
    actor_id uuid NOT NULL,
    deposit_id uuid,
    request_id uuid,
    note character varying(300),
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role public."PlatformRole" NOT NULL,
    granted_by_id uuid,
    granted_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    firebase_uid text NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    display_name character varying(60),
    area_label character varying(120),
    preferred_language public."UiLanguage" DEFAULT 'en'::public."UiLanguage" NOT NULL,
    home_lat double precision,
    home_lng double precision,
    search_radius_km integer DEFAULT 3 NOT NULL,
    disabled_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT users_email_lowercase CHECK ((email = lower(email))),
    CONSTRAINT users_home_location_pair CHECK (((home_lat IS NULL) = (home_lng IS NULL))),
    CONSTRAINT users_search_radius_km CHECK ((search_radius_km = ANY (ARRAY[1, 3, 5, 10])))
);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
0f713788-d18f-419e-a625-9ee87aecd4f5	cb0e7fafa6770036ba847737e6d2d2497f411c63109d52267edda5737cab8462	2026-10-17 02:41:27.152164+00	20261017024107_init	\N	\N	2026-10-17 02:41:26.974128+00	1
61a17e41-479a-4e98-8667-509ef34a8098	3f007ee93118e2410cdcf40c06b7a604bc81a890446c30d4e826d30bee1b77ec	2026-10-17 02:44:17.810445+00	20261017030000_geohash_c_collation	\N	\N	2026-10-17 02:44:17.787276+00	1
\.


--
-- Data for Name: communities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.communities (id, name, description, area_label, join_policy, created_at) FROM stdin;
\.


--
-- Data for Name: community_memberships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.community_memberships (community_id, user_id, role, status, granted_by_id, updated_at) FROM stdin;
\.


--
-- Data for Name: community_points; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.community_points (id, community_id, name, kind, partner_name, exact_address, public_address_consent, consented_by, consented_at, lat, lng, geohash, area_label, opening_hours, qr_id, active, created_at) FROM stdin;
\.


--
-- Data for Name: conversation_participants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conversation_participants (conversation_id, user_id, last_read_at) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conversations (id, donation_request_id, loan_id, closed, last_message_at, created_at) FROM stdin;
\.


--
-- Data for Name: deposits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deposits (id, point_id, donor_id, items, status, reviewed_by_id, review_note, created_at, reviewed_at) FROM stdin;
\.


--
-- Data for Name: donation_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.donation_requests (id, listing_id, owner_id, requester_id, quantity, message, status, pickup_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: email_otp_challenges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_otp_challenges (id, email, code_hash, attempts, expires_at, consumed_at, created_at) FROM stdin;
\.


--
-- Data for Name: idempotency_keys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.idempotency_keys (user_id, key, request_hash, response_status, response_body, created_at) FROM stdin;
\.


--
-- Data for Name: listing_photos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.listing_photos (id, listing_id, storage_path, "position", created_at) FROM stdin;
\.


--
-- Data for Name: listing_private; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.listing_private (listing_id, pickup_instructions, contact_note) FROM stdin;
\.


--
-- Data for Name: listings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.listings (id, owner_id, status, mode, category, title, description, condition, stock_total, stock_reserved, stock_collected, area_label, lat, lng, geohash, collection_method, community_point_id, appliance, max_loan_days, lending_notes, best_before, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: loans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loans (id, listing_id, owner_id, borrower_id, start_date, end_date, status, checked_out_at, returned_at, return_condition_note, message, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: medicine_cases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.medicine_cases (id, requester_id, status, partner_org_id, summary, has_prescription, preferred_contact, consented_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, conversation_id, sender_id, body, created_at) FROM stdin;
\.


--
-- Data for Name: needs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.needs (id, user_id, extraction, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, body, link, read_at, created_at) FROM stdin;
\.


--
-- Data for Name: partner_organization_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.partner_organization_members (org_id, user_id) FROM stdin;
\.


--
-- Data for Name: partner_organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.partner_organizations (id, name, verified_at) FROM stdin;
\.


--
-- Data for Name: point_inventory_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_inventory_items (id, point_id, category, title, available, reserved, best_before, updated_at) FROM stdin;
\.


--
-- Data for Name: push_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.push_tokens (id, user_id, token, platform, created_at, last_seen_at) FROM stdin;
\.


--
-- Data for Name: stock_adjustments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_adjustments (id, point_id, item_id, delta, reason, actor_id, deposit_id, request_id, note, created_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (user_id, role, granted_by_id, granted_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, firebase_uid, email, email_verified, display_name, area_label, preferred_language, home_lat, home_lng, search_radius_km, disabled_at, created_at, updated_at) FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: communities communities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_pkey PRIMARY KEY (id);


--
-- Name: community_memberships community_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_memberships
    ADD CONSTRAINT community_memberships_pkey PRIMARY KEY (community_id, user_id);


--
-- Name: community_points community_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_points
    ADD CONSTRAINT community_points_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: deposits deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_pkey PRIMARY KEY (id);


--
-- Name: donation_requests donation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_requests
    ADD CONSTRAINT donation_requests_pkey PRIMARY KEY (id);


--
-- Name: email_otp_challenges email_otp_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_otp_challenges
    ADD CONSTRAINT email_otp_challenges_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (user_id, key);


--
-- Name: listing_photos listing_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_photos
    ADD CONSTRAINT listing_photos_pkey PRIMARY KEY (id);


--
-- Name: listing_private listing_private_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_private
    ADD CONSTRAINT listing_private_pkey PRIMARY KEY (listing_id);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: loans loans_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_no_overlap EXCLUDE USING gist (listing_id WITH =, daterange(start_date, end_date, '[]'::text) WITH &&) WHERE ((status = ANY (ARRAY['approved'::public."LoanStatus", 'checked_out'::public."LoanStatus"])));


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: medicine_cases medicine_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicine_cases
    ADD CONSTRAINT medicine_cases_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: needs needs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.needs
    ADD CONSTRAINT needs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: partner_organization_members partner_organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_organization_members
    ADD CONSTRAINT partner_organization_members_pkey PRIMARY KEY (org_id, user_id);


--
-- Name: partner_organizations partner_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_organizations
    ADD CONSTRAINT partner_organizations_pkey PRIMARY KEY (id);


--
-- Name: point_inventory_items point_inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_inventory_items
    ADD CONSTRAINT point_inventory_items_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: community_memberships_user_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX community_memberships_user_id_status_idx ON public.community_memberships USING btree (user_id, status);


--
-- Name: community_points_active_geohash_c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX community_points_active_geohash_c ON public.community_points USING btree (geohash COLLATE "C") WHERE active;


--
-- Name: community_points_active_geohash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX community_points_active_geohash_idx ON public.community_points USING btree (active, geohash);


--
-- Name: community_points_qr_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX community_points_qr_id_key ON public.community_points USING btree (qr_id);


--
-- Name: conversation_participants_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_participants_user_id_idx ON public.conversation_participants USING btree (user_id);


--
-- Name: conversations_donation_request_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversations_donation_request_id_key ON public.conversations USING btree (donation_request_id);


--
-- Name: conversations_loan_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversations_loan_id_key ON public.conversations USING btree (loan_id);


--
-- Name: deposits_point_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deposits_point_id_status_idx ON public.deposits USING btree (point_id, status);


--
-- Name: donation_requests_one_active_per_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX donation_requests_one_active_per_requester ON public.donation_requests USING btree (listing_id, requester_id) WHERE (status = ANY (ARRAY['pending'::public."DonationRequestStatus", 'approved'::public."DonationRequestStatus"]));


--
-- Name: donation_requests_owner_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donation_requests_owner_id_created_at_idx ON public.donation_requests USING btree (owner_id, created_at DESC);


--
-- Name: donation_requests_requester_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donation_requests_requester_id_created_at_idx ON public.donation_requests USING btree (requester_id, created_at DESC);


--
-- Name: donation_requests_status_pickup_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donation_requests_status_pickup_by_idx ON public.donation_requests USING btree (status, pickup_by);


--
-- Name: email_otp_challenges_email_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_otp_challenges_email_created_at_idx ON public.email_otp_challenges USING btree (email, created_at);


--
-- Name: idempotency_keys_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idempotency_keys_created_at_idx ON public.idempotency_keys USING btree (created_at);


--
-- Name: listing_photos_listing_id_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listing_photos_listing_id_position_idx ON public.listing_photos USING btree (listing_id, "position");


--
-- Name: listings_active_geohash_c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listings_active_geohash_c ON public.listings USING btree (geohash COLLATE "C") WHERE (status = 'active'::public."ListingStatus");


--
-- Name: listings_owner_id_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listings_owner_id_updated_at_idx ON public.listings USING btree (owner_id, updated_at);


--
-- Name: listings_status_geohash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listings_status_geohash_idx ON public.listings USING btree (status, geohash);


--
-- Name: loans_borrower_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loans_borrower_id_created_at_idx ON public.loans USING btree (borrower_id, created_at DESC);


--
-- Name: loans_listing_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loans_listing_id_status_idx ON public.loans USING btree (listing_id, status);


--
-- Name: loans_owner_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loans_owner_id_created_at_idx ON public.loans USING btree (owner_id, created_at DESC);


--
-- Name: medicine_cases_partner_org_id_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX medicine_cases_partner_org_id_status_created_at_idx ON public.medicine_cases USING btree (partner_org_id, status, created_at);


--
-- Name: messages_conversation_id_created_at_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_id_created_at_id_idx ON public.messages USING btree (conversation_id, created_at DESC, id DESC);


--
-- Name: needs_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX needs_user_id_created_at_idx ON public.needs USING btree (user_id, created_at DESC);


--
-- Name: notifications_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: push_tokens_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX push_tokens_token_key ON public.push_tokens USING btree (token);


--
-- Name: push_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_tokens_user_id_idx ON public.push_tokens USING btree (user_id);


--
-- Name: stock_adjustments_point_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_adjustments_point_id_created_at_idx ON public.stock_adjustments USING btree (point_id, created_at);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_firebase_uid_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_firebase_uid_key ON public.users USING btree (firebase_uid);


--
-- Name: community_memberships community_memberships_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_memberships
    ADD CONSTRAINT community_memberships_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_memberships community_memberships_granted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_memberships
    ADD CONSTRAINT community_memberships_granted_by_id_fkey FOREIGN KEY (granted_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: community_memberships community_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_memberships
    ADD CONSTRAINT community_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_points community_points_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_points
    ADD CONSTRAINT community_points_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conversations conversations_donation_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_donation_request_id_fkey FOREIGN KEY (donation_request_id) REFERENCES public.donation_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conversations conversations_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: deposits deposits_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deposits deposits_point_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_point_id_fkey FOREIGN KEY (point_id) REFERENCES public.community_points(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: deposits deposits_reviewed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: donation_requests donation_requests_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_requests
    ADD CONSTRAINT donation_requests_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: donation_requests donation_requests_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_requests
    ADD CONSTRAINT donation_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: donation_requests donation_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_requests
    ADD CONSTRAINT donation_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: idempotency_keys idempotency_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: listing_photos listing_photos_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_photos
    ADD CONSTRAINT listing_photos_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: listing_private listing_private_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_private
    ADD CONSTRAINT listing_private_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: listings listings_community_point_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_community_point_id_fkey FOREIGN KEY (community_point_id) REFERENCES public.community_points(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: listings listings_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: loans loans_borrower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_borrower_id_fkey FOREIGN KEY (borrower_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: loans loans_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: loans loans_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: medicine_cases medicine_cases_partner_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicine_cases
    ADD CONSTRAINT medicine_cases_partner_org_id_fkey FOREIGN KEY (partner_org_id) REFERENCES public.partner_organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: medicine_cases medicine_cases_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicine_cases
    ADD CONSTRAINT medicine_cases_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: needs needs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.needs
    ADD CONSTRAINT needs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: partner_organization_members partner_organization_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_organization_members
    ADD CONSTRAINT partner_organization_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.partner_organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: partner_organization_members partner_organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_organization_members
    ADD CONSTRAINT partner_organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: point_inventory_items point_inventory_items_point_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_inventory_items
    ADD CONSTRAINT point_inventory_items_point_id_fkey FOREIGN KEY (point_id) REFERENCES public.community_points(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_adjustments stock_adjustments_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_adjustments stock_adjustments_deposit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_deposit_id_fkey FOREIGN KEY (deposit_id) REFERENCES public.deposits(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: stock_adjustments stock_adjustments_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.point_inventory_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_adjustments stock_adjustments_point_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_point_id_fkey FOREIGN KEY (point_id) REFERENCES public.community_points(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_granted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_granted_by_id_fkey FOREIGN KEY (granted_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Dr220FrJtJY99nKvz0J44YuoqpDv9HrbLIaGfZXb2LNVnRqRnv1TkpKJ48NI70x

