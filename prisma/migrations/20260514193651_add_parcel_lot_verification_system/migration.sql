-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "auto_validated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "spot_check" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verification_status" VARCHAR(32) NOT NULL DEFAULT 'pending_parcel',
ADD COLUMN     "vote_deadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "parcels" ADD COLUMN     "valid_until" TIMESTAMP(3),
ADD COLUMN     "validation_status" VARCHAR(32) NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "parcel_validations" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "verifier_id" UUID NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "valid_until" TIMESTAMP(3),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcel_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcel_validation_photos" (
    "id" UUID NOT NULL,
    "validation_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "gps_lat" DECIMAL(10,6) NOT NULL,
    "gps_lng" DECIMAL(10,6) NOT NULL,
    "taken_at" TIMESTAMP(3),
    "is_inside_parcel" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcel_validation_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_verifications" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "verifier_id" UUID NOT NULL,
    "vote" VARCHAR(16) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parcel_validations_parcel_id_idx" ON "parcel_validations"("parcel_id");

-- CreateIndex
CREATE INDEX "parcel_validations_verifier_id_idx" ON "parcel_validations"("verifier_id");

-- CreateIndex
CREATE INDEX "parcel_validations_status_idx" ON "parcel_validations"("status");

-- CreateIndex
CREATE INDEX "parcel_validation_photos_validation_id_idx" ON "parcel_validation_photos"("validation_id");

-- CreateIndex
CREATE INDEX "lot_verifications_lot_id_idx" ON "lot_verifications"("lot_id");

-- CreateIndex
CREATE INDEX "lot_verifications_verifier_id_idx" ON "lot_verifications"("verifier_id");

-- CreateIndex
CREATE UNIQUE INDEX "lot_verifications_lot_id_verifier_id_key" ON "lot_verifications"("lot_id", "verifier_id");

-- CreateIndex
CREATE INDEX "lots_verification_status_idx" ON "lots"("verification_status");

-- CreateIndex
CREATE INDEX "parcels_validation_status_idx" ON "parcels"("validation_status");

-- AddForeignKey
ALTER TABLE "parcel_validations" ADD CONSTRAINT "parcel_validations_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_validations" ADD CONSTRAINT "parcel_validations_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_validation_photos" ADD CONSTRAINT "parcel_validation_photos_validation_id_fkey" FOREIGN KEY ("validation_id") REFERENCES "parcel_validations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_verifications" ADD CONSTRAINT "lot_verifications_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_verifications" ADD CONSTRAINT "lot_verifications_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
