const { PrismaClient } = require('@prisma/client');
const lotService = require('../services/lot-service');
const blockchainService = require('../services/blockchain-service');

const prisma = new PrismaClient();

async function processQueue() {
  console.log('🔄 Démarrage du processeur de file d\'attente hors-ligne (SyncQueue)...');
  
  try {
    // 1. Récupérer tous les éléments en attente
    const pendingItems = await prisma.syncQueue.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 50 // Traiter par lots de 50 pour éviter les surcharges
    });

    if (pendingItems.length === 0) {
      console.log('✅ Aucun élément en attente.');
      return;
    }

    console.log(`📦 Traitement de ${pendingItems.length} requêtes...`);

    for (const item of pendingItems) {
      try {
        if (item.actionType === 'LOT_REGISTER') {
          console.log(`Traitement du lot pour l'utilisateur ${item.userId}`);
          
          await lotService.registerLot(
            prisma,
            item.payload, // Le payload contient déjà les images, le poids, etc.
            item.userId,
            blockchainService, // On passe le service blockchain
            item.clientRequestId
          );
          
          // Succès : marquer comme terminé
          await prisma.syncQueue.update({
            where: { id: item.id },
            data: { status: 'completed' }
          });
          
          console.log(`✅ Succès pour ${item.clientRequestId}`);
        } else {
          throw new Error(`Action non reconnue : ${item.actionType}`);
        }
      } catch (err) {
        console.error(`❌ Échec pour ${item.clientRequestId} :`, err.message);
        
        // Marquer comme échoué pour pouvoir debugger plus tard
        await prisma.syncQueue.update({
          where: { id: item.id },
          data: { status: 'failed' } // Ajouter errorMessage si schéma le permet
        });
      }
    }
    
    console.log('🏁 Traitement du lot terminé.');
  } catch (globalErr) {
    console.error('Erreur globale du processeur :', globalErr);
  } finally {
    await prisma.$disconnect();
  }
}

// Si le script est appelé directement (ex: CronJob ou Node)
if (require.main === module) {
  processQueue().catch(console.error);
}

module.exports = { processQueue };
