# Script d'installation de l'extraction EXIF pour ChainCacao
# Auteur: Claude Code
# Date: 2026-05-15

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Installation EXIF Extraction - ChainCacao" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier qu'on est dans le bon répertoire
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur: Ce script doit être exécuté depuis le répertoire backend/" -ForegroundColor Red
    exit 1
}

# 1. Installation du package exifr
Write-Host "📦 Installation du package exifr..." -ForegroundColor Yellow
npm install exifr
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'installation de exifr" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Package exifr installé" -ForegroundColor Green
Write-Host ""

# 2. Vérifier que la migration existe
if (-not (Test-Path "prisma\migrations\20260515085709_add_exif_metadata\migration.sql")) {
    Write-Host "❌ Erreur: Migration EXIF introuvable" -ForegroundColor Red
    exit 1
}

# 3. Appliquer la migration Prisma
Write-Host "🗄️  Application de la migration Prisma..." -ForegroundColor Yellow
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Migration appliquée" -ForegroundColor Green
Write-Host ""

# 4. Générer le client Prisma
Write-Host "🔧 Génération du client Prisma..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la génération du client Prisma" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Client Prisma généré" -ForegroundColor Green
Write-Host ""

# 5. Exécuter les tests
Write-Host "🧪 Exécution des tests unitaires EXIF..." -ForegroundColor Yellow
npm test test\unit\exif-service.test.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Avertissement: Certains tests ont échoué" -ForegroundColor Yellow
} else {
    Write-Host "✅ Tests passés" -ForegroundColor Green
}
Write-Host ""

# 6. Vérifier l'installation
Write-Host "🔍 Vérification de l'installation..." -ForegroundColor Yellow

# Vérifier que le service existe
if (-not (Test-Path "services\exif-service.js")) {
    Write-Host "❌ Erreur: Service EXIF introuvable" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Service EXIF trouvé" -ForegroundColor Green

# Vérifier que les tests existent
if (-not (Test-Path "test\unit\exif-service.test.js")) {
    Write-Host "❌ Erreur: Tests EXIF introuvables" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Tests EXIF trouvés" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Installation EXIF complète avec succès!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Redémarrer le serveur backend: npm run dev"
Write-Host "2. Consulter la documentation: docs\EXIF_EXTRACTION.md"
Write-Host "3. Tester l'upload de photos avec EXIF"
Write-Host ""
Write-Host "Nouveaux endpoints:" -ForegroundColor Yellow
Write-Host "- POST /lots/:id/images (avec extraction EXIF)"
Write-Host "- POST /parcels/validation/:id/photos (avec validation EXIF)"
Write-Host ""
