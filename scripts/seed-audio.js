const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PHRASES = [
  { key: 'welcome_msg', text: "Bienvenue ! Pour enregistrer un nouveau sac de cacao, appuie sur le très gros bouton JAUNE au milieu." },
  { key: 'btn_history', text: "Pour voir le cacao que tu as déjà vendu, appuie sur le bouton BLEU avec la liste." },
  { key: 'btn_drafts', text: "Attention, tu as des envois qui ne sont pas partis. Appuie sur le bouton GRIS en bas." },
  { key: 'step_photo_intro', text: "Nous allons prendre la photo du cacao. Appuie sur le gros bouton ROUGE avec l'appareil photo." },
  { key: 'error_photo_dark', text: "On ne voit pas bien, il fait trop sombre. Mets-toi au soleil et appuie encore sur le bouton ROUGE." },
  { key: 'step_scale_intro', text: "C'est bon pour le cacao. Maintenant, prends une photo de la balance avec le poids du sac. Appuie encore sur le bouton ROUGE." },
  { key: 'error_scale_dark', text: "On ne voit pas bien les chiffres de la balance. Rapproche-toi et appuie encore sur le bouton ROUGE." },
  { key: 'step_gps_intro', text: "Les photos sont bonnes ! Le téléphone cherche ton champ. Reste debout, ne marche pas. Attends d'entendre la musique." },
  { key: 'error_gps_weak', text: "Le téléphone ne te trouve pas. Déplace-toi là où il n'y a pas de grands arbres au-dessus de toi." },
  { key: 'btn_submit', text: "Tout est prêt ! Appuie sur le grand bouton VERT en bas pour envoyer à la coopérative." },
  { key: 'success_msg', text: "Bravo ! Le sac est bien enregistré, tu peux ranger le téléphone." },
  { key: 'offline_msg', text: "Il n'y a pas de réseau ici. C'est gardé dans le téléphone. Quand tu rentreras au village, ça partira tout seul." }
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
