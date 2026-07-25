-- CreateTable
CREATE TABLE "idempotency_record" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operation" VARCHAR(120) NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "resource_id" UUID,
    "response_status" INTEGER,
    "response_body" JSONB,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_record_organization_id_operation_key_hash_key"
ON "idempotency_record"("organization_id", "operation", "key_hash");

-- CreateIndex
CREATE INDEX "idempotency_record_expires_at_idx" ON "idempotency_record"("expires_at");

-- AddForeignKey
ALTER TABLE "idempotency_record"
ADD CONSTRAINT "idempotency_record_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- A reservation is incomplete while response fields are all NULL and complete when all are set.
ALTER TABLE "idempotency_record"
ADD CONSTRAINT "idempotency_record_completion_consistent"
CHECK (
  (
    "resource_id" IS NULL
    AND "response_status" IS NULL
    AND "response_body" IS NULL
  )
  OR
  (
    "resource_id" IS NOT NULL
    AND "response_status" IS NOT NULL
    AND "response_body" IS NOT NULL
  )
),
ADD CONSTRAINT "idempotency_record_expiration_valid"
CHECK ("expires_at" > "created_at"),
ADD CONSTRAINT "idempotency_record_response_status_valid"
CHECK ("response_status" IS NULL OR "response_status" BETWEEN 100 AND 599);
