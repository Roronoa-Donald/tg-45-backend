-- CreateTable
CREATE TABLE "audio_languages" (
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "audio_languages_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "audio_phrases" (
    "key" VARCHAR(100) NOT NULL,
    "frenchText" TEXT NOT NULL,

    CONSTRAINT "audio_phrases_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audio_translations" (
    "id" UUID NOT NULL,
    "phrase_key" VARCHAR(100) NOT NULL,
    "lang_code" VARCHAR(10) NOT NULL,
    "audio_url" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audio_translations_phrase_key_lang_code_key" ON "audio_translations"("phrase_key", "lang_code");

-- AddForeignKey
ALTER TABLE "audio_translations" ADD CONSTRAINT "audio_translations_phrase_key_fkey" FOREIGN KEY ("phrase_key") REFERENCES "audio_phrases"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_translations" ADD CONSTRAINT "audio_translations_lang_code_fkey" FOREIGN KEY ("lang_code") REFERENCES "audio_languages"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
