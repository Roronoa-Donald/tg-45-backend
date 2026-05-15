-- AlterTable
ALTER TABLE "cooperatives" ADD COLUMN     "chief_name" TEXT,
ADD COLUMN     "member_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending';
