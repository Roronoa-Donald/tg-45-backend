-- AlterTable
ALTER TABLE "audio_translations" ADD COLUMN     "history" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "exports" ADD COLUMN     "eudr_status" VARCHAR(32) NOT NULL DEFAULT 'not_started';

-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "coop_proof_image_url" TEXT,
ADD COLUMN     "eudr_status" VARCHAR(32) NOT NULL DEFAULT 'not_started',
ADD COLUMN     "hs_code" VARCHAR(16),
ADD COLUMN     "origin_country" VARCHAR(3),
ADD COLUMN     "origin_region" VARCHAR(120),
ADD COLUMN     "production_end_date" TIMESTAMP(3),
ADD COLUMN     "production_start_date" TIMESTAMP(3),
ADD COLUMN     "scale_image_url" TEXT;

-- CreateTable
CREATE TABLE "parcels" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "cooperative_id" UUID,
    "name" VARCHAR(120),
    "country_code" VARCHAR(3),
    "region" VARCHAR(120),
    "district" VARCHAR(120),
    "locality" VARCHAR(120),
    "geometry_type" VARCHAR(16) NOT NULL,
    "geometry" JSONB NOT NULL,
    "area_ha" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_parcels" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "share_pct" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eudr_due_diligence" (
    "id" UUID NOT NULL,
    "lot_id" UUID,
    "export_id" UUID,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "risk_level" VARCHAR(16),
    "assessment_summary" TEXT,
    "mitigation_summary" TEXT,
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "declaration_ref" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eudr_due_diligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eudr_documents" (
    "id" UUID NOT NULL,
    "dd_id" UUID NOT NULL,
    "doc_type" VARCHAR(64) NOT NULL,
    "url" TEXT NOT NULL,
    "checksum" TEXT,
    "issued_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eudr_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eudr_deforestation_checks" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "check_date" TIMESTAMP(3) NOT NULL,
    "result" VARCHAR(32) NOT NULL,
    "confidence" DECIMAL(5,2),
    "evidence_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eudr_deforestation_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eudr_legality_checks" (
    "id" UUID NOT NULL,
    "dd_id" UUID NOT NULL,
    "check_type" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "evidence_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eudr_legality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eudr_declarations" (
    "id" UUID NOT NULL,
    "dd_id" UUID NOT NULL,
    "payload_json" JSONB NOT NULL,
    "reference_no" VARCHAR(64),
    "submitted_by" UUID,
    "submitted_at" TIMESTAMP(3),
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eudr_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parcels_owner_id_idx" ON "parcels"("owner_id");

-- CreateIndex
CREATE INDEX "parcels_cooperative_id_idx" ON "parcels"("cooperative_id");

-- CreateIndex
CREATE INDEX "lot_parcels_lot_id_idx" ON "lot_parcels"("lot_id");

-- CreateIndex
CREATE INDEX "lot_parcels_parcel_id_idx" ON "lot_parcels"("parcel_id");

-- CreateIndex
CREATE UNIQUE INDEX "lot_parcels_lot_id_parcel_id_key" ON "lot_parcels"("lot_id", "parcel_id");

-- CreateIndex
CREATE UNIQUE INDEX "eudr_due_diligence_lot_id_key" ON "eudr_due_diligence"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "eudr_due_diligence_export_id_key" ON "eudr_due_diligence"("export_id");

-- CreateIndex
CREATE INDEX "eudr_due_diligence_status_idx" ON "eudr_due_diligence"("status");

-- CreateIndex
CREATE INDEX "eudr_due_diligence_lot_id_idx" ON "eudr_due_diligence"("lot_id");

-- CreateIndex
CREATE INDEX "eudr_due_diligence_export_id_idx" ON "eudr_due_diligence"("export_id");

-- CreateIndex
CREATE INDEX "eudr_documents_dd_id_idx" ON "eudr_documents"("dd_id");

-- CreateIndex
CREATE INDEX "eudr_deforestation_checks_parcel_id_idx" ON "eudr_deforestation_checks"("parcel_id");

-- CreateIndex
CREATE INDEX "eudr_legality_checks_dd_id_idx" ON "eudr_legality_checks"("dd_id");

-- CreateIndex
CREATE INDEX "eudr_declarations_dd_id_idx" ON "eudr_declarations"("dd_id");

-- CreateIndex
CREATE INDEX "exports_eudr_status_idx" ON "exports"("eudr_status");

-- CreateIndex
CREATE INDEX "lots_eudr_status_idx" ON "lots"("eudr_status");

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_cooperative_id_fkey" FOREIGN KEY ("cooperative_id") REFERENCES "cooperatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_parcels" ADD CONSTRAINT "lot_parcels_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_parcels" ADD CONSTRAINT "lot_parcels_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eudr_due_diligence" ADD CONSTRAINT "eudr_due_diligence_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eudr_due_diligence" ADD CONSTRAINT "eudr_due_diligence_export_id_fkey" FOREIGN KEY ("export_id") REFERENCES "exports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eudr_due_diligence" ADD CONSTRAINT "eudr_due_diligence_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eudr_due_diligence" ADD CONSTRAINT "eudr_due_diligence_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eudr_documents" ADD CONSTRAINT "eudr_documents_dd_id_fkey" FOREIGN KEY ("dd_id") REFERENCES "eudr_due_diligence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eudr_deforestation_checks" ADD CONSTRAINT "eudr_deforestation_checks_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eudr_legality_checks" ADD CONSTRAINT "eudr_legality_checks_dd_id_fkey" FOREIGN KEY ("dd_id") REFERENCES "eudr_due_diligence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eudr_declarations" ADD CONSTRAINT "eudr_declarations_dd_id_fkey" FOREIGN KEY ("dd_id") REFERENCES "eudr_due_diligence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eudr_declarations" ADD CONSTRAINT "eudr_declarations_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
