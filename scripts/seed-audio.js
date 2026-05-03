const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PHRASES = [
  { key: 'welcome_msg', text: "Bienvenue sur ton espace agriculteur." },
  { key: 'btn_new_harvest', text: "Appuie sur le gros bouton pour déclarer une nouvelle récolte." },
  { key: 'btn_history', text: "Ici, tu peux voir tout l'historique de tes anciens chargements." },
  { key: 'btn_drafts', text: "Attention, tu as des envois en attente de réseau." },
  { key: 'step_photo_intro', text: "Nous allons commencer. Appuie sur le bouton pour prendre une photo claire de ton cacao." },
  { key: 'error_photo_dark', text: "La photo est trop sombre ou floue. Mets-toi à la lumière du jour et recommence." },
  { key: 'step_weight_intro', text: "Très bien. Maintenant, utilise le clavier pour écrire le poids exact de ton sac en kilos." },
  { key: 'error_weight_invalid', text: "Ce poids ne semble pas correct. Vérifie les chiffres." },
  { key: 'step_gps_intro', text: "Parfait. L'application recherche la position exacte de ton champ. Ne bouge pas pendant quelques secondes." },
  { key: 'error_gps_weak', text: "Le signal GPS est trop faible. Déplace-toi un peu à découvert." },
  { key: 'step_final_intro', text: "Tout est bon ! Vérifie les informations." },
  { key: 'btn_submit', text: "Appuie sur le gros bouton vert en bas pour envoyer définitivement ton lot à la coopérative." },
  { key: 'success_msg', text: "Félicitations ! Ton cacao a bien été enregistré sur le réseau. Tu peux fermer l'application." },
  { key: 'offline_msg', text: "Il n'y a pas de connexion internet pour le moment. Ne t'inquiète pas, c'est sauvegardé sur ton téléphone. L'envoi se fera tout seul quand le réseau reviendra." }
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

  console.log('Seeding Audio Phrases...');
  for (const phrase of PHRASES) {
    await prisma.audioPhrase.upsert({
      where: { key: phrase.key },
      update: { frenchText: phrase.text },
      create: { key: phrase.key, frenchText: phrase.text }
    });

    // Create a PENDING translation for each language
    for (const lang of LANGUAGES) {
      const exists = await prisma.audioTranslation.findUnique({
        where: { phraseKey_langCode: { phraseKey: phrase.key, langCode: lang.code } }
      });

      if (!exists) {
        await prisma.audioTranslation.create({
          data: {
            phraseKey: phrase.key,
            langCode: lang.code,
            status: 'PENDING'
          }
        });
      }
    }
  }

  console.log('Audio seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
