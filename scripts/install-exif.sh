#!/bin/bash

# Script d'installation de l'extraction EXIF pour ChainCacao
# Auteur: Claude Code
# Date: 2026-05-15

set -e

echo "=========================================="
echo "Installation EXIF Extraction - ChainCacao"
echo "=========================================="
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "package.json" ]; then
  echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire backend/"
  exit 1
fi

# 1. Installation du package exifr
echo "📦 Installation du package exifr..."
npm install exifr
echo "✅ Package exifr installé"
echo ""

# 2. Vérifier que la migration existe
if [ ! -f "prisma/migrations/20260515085709_add_exif_metadata/migration.sql" ]; then
  echo "❌ Erreur: Migration EXIF introuvable"
  exit 1
fi

# 3. Appliquer la migration Prisma
echo "🗄️  Application de la migration Prisma..."
npx prisma migrate deploy
echo "✅ Migration appliquée"
echo ""

# 4. Générer le client Prisma
echo "🔧 Génération du client Prisma..."
npx prisma generate
echo "✅ Client Prisma généré"
echo ""

# 5. Exécuter les tests
echo "🧪 Exécution des tests unitaires EXIF..."
npm test test/unit/exif-service.test.js
echo "✅ Tests passés"
echo ""

# 6. Vérifier l'installation
echo "🔍 Vérification de l'installation..."

# Vérifier que le service existe
if [ ! -f "services/exif-service.js" ]; then
  echo "❌ Erreur: Service EXIF introuvable"
  exit 1
fi
echo "✅ Service EXIF trouvé"

# Vérifier que les tests existent
if [ ! -f "test/unit/exif-service.test.js" ]; then
  echo "❌ Erreur: Tests EXIF introuvables"
  exit 1
fi
echo "✅ Tests EXIF trouvés"

echo ""
echo "=========================================="
echo "✅ Installation EXIF complète avec succès!"
echo "=========================================="
echo ""
echo "Prochaines étapes:"
echo "1. Redémarrer le serveur backend: npm run dev"
echo "2. Consulter la documentation: docs/EXIF_EXTRACTION.md"
echo "3. Tester l'upload de photos avec EXIF"
echo ""
echo "Nouveaux endpoints:"
echo "- POST /lots/:id/images (avec extraction EXIF)"
echo "- POST /parcels/validation/:id/photos (avec validation EXIF)"
echo ""
