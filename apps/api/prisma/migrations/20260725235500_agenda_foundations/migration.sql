-- Agenda domain enums.
CREATE TYPE "session_type" AS ENUM ('ONE_ON_ONE', 'GROUP', 'CHECKPOINT');
CREATE TYPE "session_status" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');
CREATE TYPE "session_phase" AS ENUM ('FASE_1', 'FASE_2');
CREATE TYPE "confirmation_status" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');
CREATE TYPE "attendance_status" AS ENUM ('PENDING', 'ATTENDED', 'ABSENT');
CREATE TYPE "reschedule_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "schedule_resource_type" AS ENUM ('USER', 'ENROLLMENT');
CREATE TYPE "reminder_status" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- Session aggregate.
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "oleada_id" UUID NOT NULL,
    "mentor_user_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "type" "session_type" NOT NULL,
    "phase" "session_phase" NOT NULL,
    "week_number" INTEGER,
    "checkpoint_month" INTEGER,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "confirmation_closes_at" TIMESTAMPTZ(3) NOT NULL,
    "meeting_url" VARCHAR(2048),
    "status" "session_status" NOT NULL DEFAULT 'SCHEDULED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "rescheduled_from_id" UUID,
    "reschedule_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session_participant" (
    "session_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "confirmation_status" "confirmation_status" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMPTZ(3),
    "attendance_status" "attendance_status" NOT NULL DEFAULT 'PENDING',
    "attendance_recorded_at" TIMESTAMPTZ(3),
    "attendance_recorded_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_participant_pkey" PRIMARY KEY ("session_id", "enrollment_id")
);

CREATE TABLE "session_reschedule_request" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "proposed_starts_at" TIMESTAMPTZ(3),
    "reason" VARCHAR(1000) NOT NULL,
    "status" "reschedule_request_status" NOT NULL DEFAULT 'PENDING',
    "decided_by_user_id" UUID,
    "decision_reason" VARCHAR(1000),
    "replacement_session_id" UUID,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_reschedule_request_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "schedule_reservation" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "resource_type" "schedule_resource_type" NOT NULL,
    "resource_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "released_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_reservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session_reminder" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "channel" VARCHAR(40) NOT NULL,
    "send_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "reminder_status" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" VARCHAR(180) NOT NULL,
    "provider_message_id" VARCHAR(255),
    "last_error_code" VARCHAR(120),
    "locked_at" TIMESTAMPTZ(3),
    "lock_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_reminder_pkey" PRIMARY KEY ("id")
);

-- Query and uniqueness indexes.
CREATE UNIQUE INDEX "session_rescheduled_from_id_key" ON "session"("rescheduled_from_id");
CREATE INDEX "session_oleada_id_status_starts_at_idx" ON "session"("oleada_id", "status", "starts_at");
CREATE INDEX "session_mentor_user_id_starts_at_idx" ON "session"("mentor_user_id", "starts_at");
CREATE INDEX "session_participant_enrollment_id_session_id_idx" ON "session_participant"("enrollment_id", "session_id");
CREATE UNIQUE INDEX "session_reschedule_request_replacement_session_id_key" ON "session_reschedule_request"("replacement_session_id");
CREATE INDEX "session_reschedule_request_session_id_status_requested_at_idx" ON "session_reschedule_request"("session_id", "status", "requested_at");
CREATE INDEX "session_reschedule_request_requested_by_user_id_status_requested_at_idx" ON "session_reschedule_request"("requested_by_user_id", "status", "requested_at");
CREATE UNIQUE INDEX "session_reschedule_request_one_pending_idx"
  ON "session_reschedule_request"("session_id", "requested_by_user_id")
  WHERE "status" = 'PENDING';
CREATE INDEX "schedule_reservation_session_id_released_at_idx" ON "schedule_reservation"("session_id", "released_at");
CREATE INDEX "schedule_reservation_resource_type_resource_id_released_at_idx" ON "schedule_reservation"("resource_type", "resource_id", "released_at");
CREATE UNIQUE INDEX "session_reminder_idempotency_key_key" ON "session_reminder"("idempotency_key");
CREATE INDEX "session_reminder_status_send_at_idx" ON "session_reminder"("status", "send_at");
CREATE INDEX "session_reminder_session_id_status_idx" ON "session_reminder"("session_id", "status");

-- Aggregate relations.
ALTER TABLE "session" ADD CONSTRAINT "session_oleada_id_fkey"
  FOREIGN KEY ("oleada_id") REFERENCES "oleada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session" ADD CONSTRAINT "session_mentor_user_id_fkey"
  FOREIGN KEY ("mentor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session" ADD CONSTRAINT "session_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session" ADD CONSTRAINT "session_rescheduled_from_id_fkey"
  FOREIGN KEY ("rescheduled_from_id") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "session_participant" ADD CONSTRAINT "session_participant_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_participant" ADD CONSTRAINT "session_participant_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_participant" ADD CONSTRAINT "session_participant_attendance_recorded_by_fkey"
  FOREIGN KEY ("attendance_recorded_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "session_reschedule_request" ADD CONSTRAINT "session_reschedule_request_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_reschedule_request" ADD CONSTRAINT "session_reschedule_request_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_reschedule_request" ADD CONSTRAINT "session_reschedule_request_decided_by_user_id_fkey"
  FOREIGN KEY ("decided_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "session_reschedule_request" ADD CONSTRAINT "session_reschedule_request_replacement_session_id_fkey"
  FOREIGN KEY ("replacement_session_id") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_reservation" ADD CONSTRAINT "schedule_reservation_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_reminder" ADD CONSTRAINT "session_reminder_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants.
ALTER TABLE "session"
  ADD CONSTRAINT "session_valid_phase_period" CHECK (
    (
      "phase" = 'FASE_1'
      AND "week_number" BETWEEN 1 AND 6
      AND "checkpoint_month" IS NULL
    )
    OR
    (
      "phase" = 'FASE_2'
      AND "week_number" IS NULL
      AND "checkpoint_month" IN (1, 2, 3, 6)
    )
  ),
  ADD CONSTRAINT "session_valid_interval" CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "session_valid_confirmation_cutoff" CHECK ("confirmation_closes_at" <= "starts_at"),
  ADD CONSTRAINT "session_version_positive" CHECK ("version" > 0);

ALTER TABLE "session_participant"
  ADD CONSTRAINT "session_participant_confirmation_time_valid" CHECK (
    (
      "confirmation_status" = 'PENDING'
      AND "confirmed_at" IS NULL
    )
    OR
    (
      "confirmation_status" IN ('CONFIRMED', 'DECLINED')
      AND "confirmed_at" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "session_participant_attendance_time_valid" CHECK (
    (
      "attendance_status" = 'PENDING'
      AND "attendance_recorded_at" IS NULL
      AND "attendance_recorded_by" IS NULL
    )
    OR
    (
      "attendance_status" IN ('ATTENDED', 'ABSENT')
      AND "attendance_recorded_at" IS NOT NULL
      AND "attendance_recorded_by" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "session_participant_version_positive" CHECK ("version" > 0);

ALTER TABLE "session_reschedule_request"
  ADD CONSTRAINT "session_reschedule_request_decision_valid" CHECK (
    (
      "status" = 'PENDING'
      AND "decided_by_user_id" IS NULL
      AND "decision_reason" IS NULL
      AND "replacement_session_id" IS NULL
    )
    OR
    (
      "status" = 'APPROVED'
      AND "decided_by_user_id" IS NOT NULL
      AND "replacement_session_id" IS NOT NULL
    )
    OR
    (
      "status" = 'REJECTED'
      AND "decided_by_user_id" IS NOT NULL
      AND "decision_reason" IS NOT NULL
      AND "replacement_session_id" IS NULL
    )
    OR
    (
      "status" = 'CANCELLED'
      AND "replacement_session_id" IS NULL
    )
  ),
  ADD CONSTRAINT "session_reschedule_request_version_positive" CHECK ("version" > 0);

ALTER TABLE "schedule_reservation"
  ADD CONSTRAINT "schedule_reservation_valid_interval" CHECK ("ends_at" > "starts_at");

ALTER TABLE "session_reminder"
  ADD CONSTRAINT "session_reminder_attempt_count_nonnegative" CHECK ("attempt_count" >= 0),
  ADD CONSTRAINT "session_reminder_lock_valid" CHECK (
    ("locked_at" IS NULL AND "lock_expires_at" IS NULL)
    OR
    ("locked_at" IS NOT NULL AND "lock_expires_at" > "locked_at")
  );

-- The same resource cannot be reserved by overlapping live sessions.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "schedule_reservation"
  ADD CONSTRAINT "schedule_reservation_no_overlap"
  EXCLUDE USING gist (
    "resource_type" WITH =,
    "resource_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("released_at" IS NULL);
