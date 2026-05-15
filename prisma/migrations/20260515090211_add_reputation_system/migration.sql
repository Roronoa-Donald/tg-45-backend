-- CreateTable
CREATE TABLE "reputation_scores" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 100,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reputation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" VARCHAR(32) NOT NULL,
    "points" INTEGER NOT NULL,
    "lot_id" UUID,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reputation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_cases" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "reported_by" UUID NOT NULL,
    "reported_against" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ouvert',
    "resolution" TEXT,
    "resolved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "dispute_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reputation_scores_user_id_key" ON "reputation_scores"("user_id");

-- CreateIndex
CREATE INDEX "reputation_scores_score_idx" ON "reputation_scores"("score");

-- CreateIndex
CREATE INDEX "reputation_events_user_id_idx" ON "reputation_events"("user_id");

-- CreateIndex
CREATE INDEX "reputation_events_event_type_idx" ON "reputation_events"("event_type");

-- CreateIndex
CREATE INDEX "reputation_events_created_at_idx" ON "reputation_events"("created_at");

-- CreateIndex
CREATE INDEX "dispute_cases_lot_id_idx" ON "dispute_cases"("lot_id");

-- CreateIndex
CREATE INDEX "dispute_cases_reported_by_idx" ON "dispute_cases"("reported_by");

-- CreateIndex
CREATE INDEX "dispute_cases_reported_against_idx" ON "dispute_cases"("reported_against");

-- CreateIndex
CREATE INDEX "dispute_cases_status_idx" ON "dispute_cases"("status");

-- AddForeignKey
ALTER TABLE "reputation_scores" ADD CONSTRAINT "reputation_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_reported_against_fkey" FOREIGN KEY ("reported_against") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
