const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PHRASES = [
  { key: 'welcome_msg', text: "Bienvenue ! Pour enregistrer un nouveau sac, appuie sur le bouton NOUVEAU SAC." },
  { key: 'btn_history', text: "Pour voir les lots déjà enregistrés, ouvre l'onglet Historique." },
  { key: 'btn_drafts', text: "Les lots en attente sont marqués EN ATTENTE dans l'historique." },
  { key: 'permission_camera', text: "Autorise la caméra pour pouvoir prendre les photos." },
  { key: 'step_photo_intro', text: "Écran SAC. Appuie sur le bouton rond pour prendre la photo du sac." },
  { key: 'error_photo_dark', text: "La photo est trop sombre. Mets-toi à la lumière et recommence." },
  { key: 'step_scale_intro', text: "Écran BALANCE. Appuie sur le bouton rond pour prendre la photo de la balance." },
  { key: 'error_scale_dark', text: "On ne voit pas bien les chiffres. Rapproche-toi et recommence." },
  { key: 'step_gps_intro', text: "Le téléphone cherche ta position. Reste immobile quelques secondes." },
  { key: 'error_gps_weak', text: "La position est faible. Va dans un endroit dégagé et attends." },
  { key: 'select_parcel', text: "Si tu as des parcelles, choisis-les dans la liste." },
  { key: 'btn_submit', text: "Tout est prêt. Appuie sur ENREGISTRER." },
  { key: 'success_msg', text: "Bravo ! Le sac est enregistré." },
  { key: 'offline_msg', text: "Sans réseau, c'est gardé et envoyé plus tard." }
];

const LANGUAGES = [
  { code: 'ee', name: 'Ewe' },
  { code: 'kbp', name: 'Kabyè' }
];

async function main() {
  console.log('Seeding Audio Languages...');
  for (const lang of LANGUAGES) {
    await prisma.audioLanguage.upsert({
      where: { code: lang.code },
      update: {},
      create: lang
    });
  }

  console.log('Seeding Audio Phrases (Orienté Analphabète + Flux Photo Balance)...');
  
  // Clean up old ones that are no longer used
  await prisma.audioTranslation.deleteMany({});
  await prisma.audioPhrase.deleteMany({});

  for (const phrase of PHRASES) {
    await prisma.audioPhrase.upsert({
      where: { key: phrase.key },
      update: { frenchText: phrase.text },
      create: { key: phrase.key, frenchText: phrase.text }
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
  }

  console.log('Seed des nouvelles phrases terminé !');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
