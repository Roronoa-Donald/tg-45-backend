// Script pour corriger les lots auto-validés qui ne sont pas certifiés
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAutoValidatedLots() {
  console.log('🔧 Correction des lots auto-validés non certifiés...\n');

  try {
    // Trouver les lots auto-validés mais pas certifiés
    const lots = await prisma.lot.findMany({
      where: {
        autoValidated: true,
        status: 'registered' // Devrait être 'certified'
      },
      include: {
        owner: { select: { id: true, name: true } }
      }
    });

    console.log(`📊 ${lots.length} lot(s) à corriger\n`);

    if (lots.length === 0) {
      console.log('✅ Aucun lot à corriger !');
      return;
    }

    for (const lot of lots) {
      console.log(`Correction de ${lot.lotCode || lot.id.substring(0, 8)}...`);

      await prisma.$transaction(async (tx) => {
        // Mettre à jour le statut
        await tx.lot.update({
          where: { id: lot.id },
          data: {
            status: 'certified',
            verificationStatus: 'auto_validated'
          }
        });

        // Créer la certification si elle n'existe pas
        const existingCert = await tx.lotCertification.findUnique({
          where: { lotId: lot.id }
        });

        if (!existingCert) {
          // Trouver un verifier pour la certification (ou utiliser le premier disponible)
          const anyVerifier = await tx.user.findFirst({
            where: { role: 'verifier' },
            select: { id: true }
          });

          if (anyVerifier) {
            await tx.lotCertification.create({
              data: {
                lotId: lot.id,
                verifierId: anyVerifier.id,
                signature: null,
                status: 'approved'
              }
            });
            console.log('  ✅ Certification créée');
          } else {
            console.log('  ⚠️  Aucun verifier trouvé, certification non créée');
          }
        }

        // Créer un event
        await tx.lotEvent.create({
          data: {
            lotId: lot.id,
            eventType: 'auto_certified_fixed',
            metadata: {
              reason: 'Correction automatique - parcelle validée'
            }
          }
        });

        // Ajouter reputation si pas déjà fait
        const existingRepEvent = await tx.reputationEvent.findFirst({
          where: {
            userId: lot.owner.id,
            lotId: lot.id,
            eventType: 'LOT_CERTIFIED'
          }
        });

        if (!existingRepEvent) {
          const reputationService = require('../services/reputation-service');
          await reputationService.recordEvent(
            tx,
            lot.owner.id,
            reputationService.EVENT_TYPES.LOT_CERTIFIED,
            lot.id,
            'Lot certifié (correction auto)'
          );
          console.log('  ✅ Reputation +5 points');
        }
      });

      console.log(`  ✅ Status: certified\n`);
    }

    console.log(`\n✅ ${lots.length} lot(s) corrigé(s) avec succès !`);

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter
fixAutoValidatedLots().catch(console.error);
