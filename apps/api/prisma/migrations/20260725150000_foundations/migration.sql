-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "organization_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "role_key" AS ENUM ('PARTICIPANT', 'MENTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "mentor_capability_kind" AS ENUM ('SPECIALIST', 'PEER');

-- CreateEnum
CREATE TYPE "oleada_status" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "program_phase" AS ENUM ('FASE_0', 'FASE_1', 'FASE_2', 'FINISHED');

-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "status" "organization_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "normalized_email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "sector" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "key" "role_key" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by_user_id" UUID,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "mentor_profile" (
    "user_id" UUID NOT NULL,
    "headline" VARCHAR(200),
    "bio" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mentor_profile_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "mentor_capability" (
    "mentor_profile_id" UUID NOT NULL,
    "kind" "mentor_capability_kind" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_capability_pkey" PRIMARY KEY ("mentor_profile_id","kind")
);

-- CreateTable
CREATE TABLE "oleada" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "sector" VARCHAR(120) NOT NULL,
    "status" "oleada_status" NOT NULL DEFAULT 'DRAFT',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "capacity" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "oleada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "oleada_id" UUID NOT NULL,
    "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "current_phase" "program_phase" NOT NULL DEFAULT 'FASE_0',
    "current_week" INTEGER,
    "phase_1_graduated_at" TIMESTAMPTZ(3),
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_assignment" (
    "id" UUID NOT NULL,
    "mentor_user_id" UUID NOT NULL,
    "oleada_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "capability" "mentor_capability_kind" NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mentor_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_family_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "user_agent" VARCHAR(512),
    "ip_hash" VARCHAR(128),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "trace_id" VARCHAR(64) NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(160) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" VARCHAR(180) NOT NULL,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "user_organization_id_is_active_idx" ON "user"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_organization_id_normalized_email_key" ON "user"("organization_id", "normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "role_key_key" ON "role"("key");

-- CreateIndex
CREATE INDEX "user_role_role_id_idx" ON "user_role"("role_id");

-- CreateIndex
CREATE INDEX "oleada_organization_id_status_idx" ON "oleada"("organization_id", "status");

-- CreateIndex
CREATE INDEX "enrollment_oleada_id_status_current_phase_idx" ON "enrollment"("oleada_id", "status", "current_phase");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_user_id_oleada_id_key" ON "enrollment"("user_id", "oleada_id");

-- CreateIndex
CREATE INDEX "mentor_assignment_mentor_user_id_oleada_id_ends_at_idx" ON "mentor_assignment"("mentor_user_id", "oleada_id", "ends_at");

-- CreateIndex
CREATE INDEX "mentor_assignment_enrollment_id_ends_at_idx" ON "mentor_assignment"("enrollment_id", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_session_refresh_token_hash_key" ON "auth_session"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_session_replaced_by_id_key" ON "auth_session"("replaced_by_id");

-- CreateIndex
CREATE INDEX "auth_session_user_id_revoked_at_expires_at_idx" ON "auth_session"("user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "auth_session_token_family_id_idx" ON "auth_session"("token_family_id");

-- CreateIndex
CREATE INDEX "audit_log_organization_id_entity_type_entity_id_occurred_at_idx" ON "audit_log"("organization_id", "entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_trace_id_idx" ON "audit_log"("trace_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_event_idempotency_key_key" ON "outbox_event"("idempotency_key");

-- CreateIndex
CREATE INDEX "outbox_event_published_at_occurred_at_idx" ON "outbox_event"("published_at", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_event_organization_id_aggregate_type_aggregate_id_idx" ON "outbox_event"("organization_id", "aggregate_type", "aggregate_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profile" ADD CONSTRAINT "mentor_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_capability" ADD CONSTRAINT "mentor_capability_mentor_profile_id_fkey" FOREIGN KEY ("mentor_profile_id") REFERENCES "mentor_profile"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oleada" ADD CONSTRAINT "oleada_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_oleada_id_fkey" FOREIGN KEY ("oleada_id") REFERENCES "oleada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignment" ADD CONSTRAINT "mentor_assignment_mentor_user_id_fkey" FOREIGN KEY ("mentor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignment" ADD CONSTRAINT "mentor_assignment_oleada_id_fkey" FOREIGN KEY ("oleada_id") REFERENCES "oleada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignment" ADD CONSTRAINT "mentor_assignment_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "auth_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foundation invariants not expressible in the Prisma schema.
ALTER TABLE "user"
ADD CONSTRAINT "user_version_positive" CHECK ("version" > 0);

ALTER TABLE "oleada"
ADD CONSTRAINT "oleada_capacity_positive" CHECK ("capacity" > 0),
ADD CONSTRAINT "oleada_date_range_valid" CHECK ("end_date" >= "start_date"),
ADD CONSTRAINT "oleada_version_positive" CHECK ("version" > 0);

ALTER TABLE "enrollment"
ADD CONSTRAINT "enrollment_current_week_valid"
  CHECK ("current_week" IS NULL OR "current_week" BETWEEN 1 AND 6),
ADD CONSTRAINT "enrollment_version_positive" CHECK ("version" > 0);

ALTER TABLE "mentor_assignment"
ADD CONSTRAINT "mentor_assignment_period_valid"
  CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at"),
ADD CONSTRAINT "mentor_assignment_version_positive" CHECK ("version" > 0);

ALTER TABLE "auth_session"
ADD CONSTRAINT "auth_session_expiration_valid" CHECK ("expires_at" > "created_at");

ALTER TABLE "outbox_event"
ADD CONSTRAINT "outbox_event_attempt_count_nonnegative" CHECK ("attempt_count" >= 0);
