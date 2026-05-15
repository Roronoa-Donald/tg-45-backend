-- AlterTable: Add EXIF metadata columns to lot_images
ALTER TABLE "lot_images" ADD COLUMN "exif_data" JSONB,
ADD COLUMN "gps_lat" DECIMAL(10,8),
ADD COLUMN "gps_lng" DECIMAL(11,8),
ADD COLUMN "taken_at" TIMESTAMP(3);

-- AlterTable: Add EXIF metadata and validation columns to parcel_validation_photos
ALTER TABLE "parcel_validation_photos" ADD COLUMN "exif_data" JSONB,
ADD COLUMN "gps_valid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "gps_validation_reason" TEXT;
