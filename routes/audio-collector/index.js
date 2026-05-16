const { AppError } = require('../../utils/errors');
const { successEnvelope } = require('../../utils/response');

module.exports = async function audioCollectorRoutes(app) {

  // 1. Get queue for a specific language
  // Return the next PENDING phrase or a summary of progress
  app.get('/queue', async (request) => {
    const { lang } = request.query;
    if (!lang) throw new AppError('invalid_input', 'lang query param is required', 400);

    const total = await app.prisma.audioTranslation.count({
      where: { langCode: lang }
    });

    const recorded = await app.prisma.audioTranslation.count({
      where: { langCode: lang, status: 'RECORDED' }
    });

    // Get all pending for this lang
    const pending = await app.prisma.audioTranslation.findMany({
      where: { langCode: lang, status: 'PENDING' },
      include: { phrase: true },
      orderBy: { phraseKey: 'asc' }
    });

    return successEnvelope({
      progress: { total, recorded, pending: pending.length },
      next: pending.length > 0 ? pending[0] : null
    });
  });

  // 2. Save an audio URL to a translation (Multipart form-data)
  app.post('/translations/:id', async (request, reply) => {
    const { id } = request.params;
    
    // Process multipart
    const data = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
    if (!data) {
      throw new AppError('invalid_input', 'No audio file uploaded', 400);
    }
    if (data.file.truncated) {
      throw new AppError('invalid_input', 'File is too large (max 5MB)', 400);
    }

    const translation = await app.prisma.audioTranslation.findUnique({ where: { id } });
    if (!translation) throw new AppError('not_found', 'Translation not found', 404);

    // Read the file stream into a buffer
    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Upload to Cloudinary using the custom storage method
    let audioUrl;
    try {
      const uploadResult = await app.storage.uploadAudio(buffer, {
        folder: `chaincacao/audio/${translation.langCode}`,
        resource_type: 'video', // Cloudinary uses video for audio files
        public_id: `${translation.phraseKey}_${Date.now()}`
      });
      audioUrl = uploadResult.secure_url;
    } catch (err) {
      app.log.error('Cloudinary audio upload failed:', err);
      throw new AppError('upload_failed', 'Failed to upload audio to Cloudinary', 500);
    }

    const updatedTranslation = await app.prisma.audioTranslation.update({
      where: { id },
      data: {
        audioUrl,
        status: 'RECORDED'
      }
    });

    return successEnvelope(updatedTranslation);
  });

  // 2.5 Public: Get all recorded translations for mobile app
  app.get('/translations', async (request) => {
    const translations = await app.prisma.audioTranslation.findMany({
      where: { status: 'RECORDED' },
      select: { langCode: true, phraseKey: true, audioUrl: true }
    });
    return successEnvelope(translations);
  });

  // 3. Admin: Get all translations (to review)
  app.get('/admin/translations', async (request) => {
    const password = request.headers['x-admin-password'];
    if (password !== process.env.ADMIN_AUDIO_PASSWORD) {
      throw new AppError('unauthorized', 'Admin password incorrect', 401);
    }

    const translations = await app.prisma.audioTranslation.findMany({
      include: { phrase: true, language: true },
      orderBy: [
        { status: 'asc' }, // PENDING first, then RECORDED
        { langCode: 'asc' },
        { phraseKey: 'asc' }
      ]
    });

    return successEnvelope(translations);
  });

  // 4. Admin: Reject a translation
  app.post('/admin/reject/:id', async (request) => {
    const password = request.headers['x-admin-password'];
    if (password !== process.env.ADMIN_AUDIO_PASSWORD) {
      throw new AppError('unauthorized', 'Admin password incorrect', 401);
    }

    const { id } = request.params;
    const translation = await app.prisma.audioTranslation.findUnique({ where: { id } });
    if (!translation) throw new AppError('not_found', 'Translation not found', 404);

    // Append current audioUrl to history
    const currentHistory = translation.history && Array.isArray(translation.history) ? translation.history : [];
    if (translation.audioUrl) {
      currentHistory.push({
        url: translation.audioUrl,
        rejectedAt: new Date().toISOString()
      });
    }

    const updatedTranslation = await app.prisma.audioTranslation.update({
      where: { id },
      data: {
        audioUrl: null,
        status: 'PENDING',
        history: currentHistory
      }
    });

    return successEnvelope(updatedTranslation);
  });
};
