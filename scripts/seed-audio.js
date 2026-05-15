const { PrismaClient } = require('@prisma/client');
const { v2: cloudinary } = require('cloudinary');

const prisma = new PrismaClient();

// Configure Cloudinary from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const PHRASES = [
  // === ÉCRAN D'ACCUEIL ===
  {
    key: 'welcome_msg',
    text: "Bienvenue ! Pour enregistrer un nouveau sac de cacao, appuie sur le gros bouton doré au milieu de l'écran."
  },
  {
    key: 'btn_history',
    text: "Pour voir tes anciens sacs, appuie sur le petit bouton en bas à gauche."
  },
  {
    key: 'btn_parcels',
    text: "Pour voir tes parcelles, appuie sur le petit bouton à côté, en bas."
  },
  {
    key: 'pending_count',
    text: "Attention, tu as des sacs qui attendent d'être envoyés. Ils partiront dès que le wifi reviendra."
  },

  // === CAPTURE - ÉTAPE 1 : PHOTO SAC ===
  {
    key: 'permission_camera',
    text: "L'application a besoin de ta caméra pour prendre les photos. Appuie sur le bouton Autoriser."
  },
  {
    key: 'step_photo_sac',
    text: "Place ton sac de cacao devant toi, puis appuie sur le gros rond blanc en bas pour prendre la photo."
  },
  {
    key: 'error_photo_dark',
    text: "La photo est trop sombre. Mets-toi à la lumière du jour et recommence."
  },

  // === CAPTURE - ÉTAPE 2 : PHOTO BALANCE ===
  {
    key: 'step_photo_balance',
    text: "Prends une photo claire des chiffres sur la balance, puis appuie sur le gros rond blanc en bas."
  },
  {
    key: 'error_scale_unreadable',
    text: "On ne voit pas bien les chiffres sur la balance. Rapproche-toi et assure-toi que c'est bien éclairé."
  },

  // === CAPTURE - ÉTAPE FINALE : VALIDATION ===
  {
    key: 'step_select_parcel',
    text: "Choisis ta parcelle dans la liste en appuyant dessus. Elle deviendra dorée quand elle est sélectionnée."
  },
  {
    key: 'step_gps_searching',
    text: "Le téléphone cherche ta position. Reste immobile quelques secondes dehors."
  },
  {
    key: 'error_gps_weak',
    text: "Le signal est trop faible. Sors à l'extérieur dans un endroit dégagé et attends."
  },
  {
    key: 'error_gps_denied',
    text: "Tu as refusé l'accès à la position. Va dans les réglages du téléphone pour l'autoriser."
  },
  {
    key: 'error_outside_parcel',
    text: "Tu n'es pas dans la parcelle que tu as choisie. Déplace-toi dans ta parcelle ou choisis une autre."
  },
  {
    key: 'btn_submit',
    text: "Tout est prêt ! Appuie sur le gros bouton doré en bas pour sauvegarder ton sac."
  },
  {
    key: 'btn_restart',
    text: "Pour recommencer depuis le début, appuie sur le bouton rose en bas."
  },

  // === MESSAGES DE SUCCÈS / ERREUR ===
  {
    key: 'success_msg',
    text: "Bravo ! Ton sac de cacao a bien été enregistré. Il sera envoyé à la coopérative dès que tu auras du wifi."
  },
  {
    key: 'offline_msg',
    text: "Pas de wifi pour le moment, mais ne t'inquiète pas. Ton sac est sauvegardé sur le téléphone et partira tout seul quand le wifi reviendra."
  },
  {
    key: 'sync_in_progress',
    text: "Tes sacs sont en train de s'envoyer. Attends quelques secondes."
  },
  {
    key: 'sync_complete',
    text: "Tous tes sacs ont été envoyés avec succès !"
  },

  // === ÉCRAN HISTORIQUE ===
  {
    key: 'history_empty',
    text: "Tu n'as pas encore de sacs enregistrés. Appuie sur le bouton doré de l'accueil pour commencer."
  },
  {
    key: 'history_intro',
    text: "Voici la liste de tous tes sacs. Les pastilles de couleur montrent leur état : orange pour en attente, vert pour validé."
  },
];

const LANGUAGES = [
  { code: 'ee', name: 'Ewe' },
  { code: 'kbp', name: 'Kabyè' }
];

async function deleteCloudinaryAudios(translations) {
  const audioUrls = translations
    .filter(t => t.audioUrl && !t.audioUrl.includes('mock.cloudinary.com'))
    .map(t => t.audioUrl);

  if (audioUrls.length === 0) {
    console.log('Aucun fichier audio Cloudinary à supprimer.');
    return;
  }

  console.log(`Suppression de ${audioUrls.length} fichiers audio sur Cloudinary...`);

  for (const url of audioUrls) {
    try {
      // Extract public_id from Cloudinary URL
      // Format: https://res.cloudinary.com/{cloud}/video/upload/v{version}/{folder}/{public_id}.{ext}
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
      if (match && match[1]) {
        const publicId = match[1];
        console.log(`  Suppression: ${publicId}`);
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
      }
    } catch (err) {
      console.warn(`  Échec suppression pour ${url}:`, err.message);
    }
  }

  console.log('Suppression Cloudinary terminée.');
}

async function main() {
  console.log('=== SEED AUDIO - NOUVELLES PHRASES ADAPTÉES ===\n');

  // 1. Récupérer les anciennes traductions avec leurs URLs audio
  console.log('Récupération des anciennes traductions...');
  const oldTranslations = await prisma.audioTranslation.findMany({
    where: { audioUrl: { not: null } }
  });
  console.log(`  ${oldTranslations.length} traductions avec audio trouvées.`);

  // 2. Supprimer les fichiers audio de Cloudinary
  if (oldTranslations.length > 0) {
    await deleteCloudinaryAudios(oldTranslations);
  }

  // 3. Supprimer les anciennes données de la base
  console.log('\nNettoyage de la base de données...');
  const deletedTranslations = await prisma.audioTranslation.deleteMany({});
  console.log(`  ${deletedTranslations.count} traductions supprimées.`);

  const deletedPhrases = await prisma.audioPhrase.deleteMany({});
  console.log(`  ${deletedPhrases.count} phrases supprimées.`);

  // 4. Créer les langues (upsert)
  console.log('\nCréation des langues...');
  for (const lang of LANGUAGES) {
    await prisma.audioLanguage.upsert({
      where: { code: lang.code },
      update: {},
      create: lang
    });
    console.log(`  ✓ ${lang.name} (${lang.code})`);
  }

  // 5. Créer les nouvelles phrases et traductions
  console.log(`\nCréation de ${PHRASES.length} nouvelles phrases...`);
  for (const phrase of PHRASES) {
    await prisma.audioPhrase.create({
      data: {
        key: phrase.key,
        frenchText: phrase.text
      }
    });

    for (const lang of LANGUAGES) {
      await prisma.audioTranslation.create({
        data: {
          phraseKey: phrase.key,
          langCode: lang.code,
          status: 'PENDING'
        }
      });
    }
    console.log(`  ✓ ${phrase.key}`);
  }

  // 6. Résumé
  const totalTranslations = PHRASES.length * LANGUAGES.length;
  console.log('\n=== RÉSUMÉ ===');
  console.log(`  Phrases créées: ${PHRASES.length}`);
  console.log(`  Langues: ${LANGUAGES.map(l => l.name).join(', ')}`);
  console.log(`  Traductions à enregistrer: ${totalTranslations}`);
  console.log('\n✅ Seed terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
