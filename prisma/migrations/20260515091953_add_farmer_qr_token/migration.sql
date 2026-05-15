-- AlterTable
ALTER TABLE "users" ADD COLUMN "farmer_qr_token" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "users_farmer_qr_token_key" ON "users"("farmer_qr_token");
