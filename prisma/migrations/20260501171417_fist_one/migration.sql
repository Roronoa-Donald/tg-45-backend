-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "role" VARCHAR(32) NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "pin_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cooperative_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperatives" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooperatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperative_members" (
    "id" UUID NOT NULL,
    "cooperative_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cooperative_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmer_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "farm_name" TEXT,
    "location" TEXT,
    "language" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farmer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL,
    "lot_code" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "cooperative_id" UUID,
    "product" TEXT NOT NULL,
    "variety" TEXT,
    "weight_kg" DECIMAL(10,2) NOT NULL,
    "harvest_date" TIMESTAMP(3),
    "gps_origin_lat" DECIMAL(10,6) NOT NULL,
    "gps_origin_lng" DECIMAL(10,6) NOT NULL,
    "gps_precision_m" INTEGER NOT NULL,
    "gps_area_radius_m" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "blockchain_tx_hash" TEXT,
    "blockchain_proof_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_events" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "actor_id" UUID,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "blockchain_tx_hash" TEXT,
    "blockchain_proof_hash" TEXT,

    CONSTRAINT "lot_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_images" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "public_id" TEXT,
    "checksum" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_certifications" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "verifier_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "signature" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "request_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" UUID,
    "route" TEXT NOT NULL,
    "request_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_queue" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "last_error" TEXT,
    "client_request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" UUID NOT NULL,
    "exporter_id" UUID NOT NULL,
    "cooperative_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'declared',
    "manifest_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_lots" (
    "id" UUID NOT NULL,
    "export_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,

    CONSTRAINT "export_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_events" (
    "id" UUID NOT NULL,
    "export_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "export_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "partner_name" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "cooperative_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" UUID NOT NULL,
    "api_key_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cooperative_members_cooperative_id_user_id_key" ON "cooperative_members"("cooperative_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "farmer_profiles_user_id_key" ON "farmer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lots_lot_code_key" ON "lots"("lot_code");

-- CreateIndex
CREATE UNIQUE INDEX "lot_certifications_lot_id_key" ON "lot_certifications"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE UNIQUE INDEX "export_lots_export_id_lot_id_key" ON "export_lots"("export_id", "lot_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_cooperative_id_fkey" FOREIGN KEY ("cooperative_id") REFERENCES "cooperatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooperative_members" ADD CONSTRAINT "cooperative_members_cooperative_id_fkey" FOREIGN KEY ("cooperative_id") REFERENCES "cooperatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooperative_members" ADD CONSTRAINT "cooperative_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_profiles" ADD CONSTRAINT "farmer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_cooperative_id_fkey" FOREIGN KEY ("cooperative_id") REFERENCES "cooperatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_events" ADD CONSTRAINT "lot_events_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_events" ADD CONSTRAINT "lot_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_images" ADD CONSTRAINT "lot_images_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_certifications" ADD CONSTRAINT "lot_certifications_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_certifications" ADD CONSTRAINT "lot_certifications_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_exporter_id_fkey" FOREIGN KEY ("exporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_cooperative_id_fkey" FOREIGN KEY ("cooperative_id") REFERENCES "cooperatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_lots" ADD CONSTRAINT "export_lots_export_id_fkey" FOREIGN KEY ("export_id") REFERENCES "exports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_lots" ADD CONSTRAINT "export_lots_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_events" ADD CONSTRAINT "export_events_export_id_fkey" FOREIGN KEY ("export_id") REFERENCES "exports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_cooperative_id_fkey" FOREIGN KEY ("cooperative_id") REFERENCES "cooperatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
