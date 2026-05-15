const {
  ddrCreateSchema,
  ddrUpdateSchema,
  ddrApproveSchema,
  deforestationCheckSchema,
  legalityCheckSchema,
  declarationGenerateSchema,
  declarationSubmitSchema,
  documentCreateSchema
} = require('../../schemas/eudr-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const ddrService = require('../../services/eudr-ddr-service');
const checkService = require('../../services/eudr-check-service');
const declarationService = require('../../services/eudr-declaration-service');
const documentService = require('../../services/eudr-document-service');
const auditService = require('../../services/audit-service');

module.exports = async function eudrRoutes(app) {
  app.post('/ddr', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE, USER_ROLES.EXPORTER, USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE])]
  }, async (request) => {
    const payload = parseOrThrow(ddrCreateSchema, request.body);
    const dd = await ddrService.createDueDiligence(app.prisma, payload, request.user.sub);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'create_eudr_ddr',
      targetType: 'eudr_due_diligence',
      targetId: dd.id,
      requestId: request.id
    });

    return successEnvelope(dd);
  });

  app.put('/ddr/:id', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE, USER_ROLES.EXPORTER, USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE])]
  }, async (request) => {
    const payload = parseOrThrow(ddrUpdateSchema, request.body);
    const updated = await ddrService.updateDueDiligence(app.prisma, request.params.id, payload);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'update_eudr_ddr',
      targetType: 'eudr_due_diligence',
      targetId: updated.id,
      requestId: request.id
    });

    return successEnvelope(updated);
  });

  app.get('/ddr', {
    preHandler: [authenticate]
  }, async (request) => {
    const filters = {};

    if (request.query.cooperativeId) {
      filters.cooperativeId = request.query.cooperativeId;
    }
    if (request.query.status) {
      filters.status = request.query.status;
    }

    const ddrs = await app.prisma.eudrDueDiligence.findMany({
      where: filters,
      include: {
        lot: { select: { id: true, lotCode: true } },
        documents: true,
        declarations: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return successEnvelope({ items: ddrs });
  });

  app.get('/ddr/:id', {
    preHandler: [authenticate]
  }, async (request) => {
    const dd = await app.prisma.eudrDueDiligence.findUnique({
      where: { id: request.params.id },
      include: { documents: true, legalityChecks: true, declarations: true }
    });
    if (!dd) {
      throw new AppError('not_found', 'Due diligence not found', 404);
    }
    return successEnvelope(dd);
  });

  app.post('/ddr/:id/approve', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE])]
  }, async (request) => {
    const payload = parseOrThrow(ddrApproveSchema, request.body || {});
    const updated = await ddrService.approveDueDiligence(
      app.prisma,
      request.params.id,
      request.user.sub,
      payload.approved
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'approve_eudr_ddr',
      targetType: 'eudr_due_diligence',
      targetId: updated.id,
      requestId: request.id,
      details: { approved: payload.approved }
    });

    return successEnvelope(updated);
  });

  app.post('/ddr/:id/documents', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE, USER_ROLES.COOPERATIVE, USER_ROLES.EXPORTER])]
  }, async (request) => {
    const payload = parseOrThrow(documentCreateSchema, request.body);
    const doc = await documentService.addDocument(app.prisma, request.params.id, payload);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'add_eudr_document',
      targetType: 'eudr_due_diligence',
      targetId: request.params.id,
      requestId: request.id,
      details: { docType: payload.docType }
    });

    return successEnvelope(doc);
  });

  app.post('/checks/deforestation', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE])]
  }, async (request) => {
    const payload = parseOrThrow(deforestationCheckSchema, request.body);
    const record = await checkService.createDeforestationCheck(app.prisma, payload);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'create_deforestation_check',
      targetType: 'parcel',
      targetId: payload.parcelId,
      requestId: request.id
    });

    return successEnvelope(record);
  });

  app.post('/checks/legality', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE])]
  }, async (request) => {
    const payload = parseOrThrow(legalityCheckSchema, request.body);
    const record = await checkService.createLegalityCheck(app.prisma, payload);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'create_legality_check',
      targetType: 'eudr_due_diligence',
      targetId: payload.ddId,
      requestId: request.id
    });

    return successEnvelope(record);
  });

  app.post('/declarations/generate', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE, USER_ROLES.EXPORTER])]
  }, async (request) => {
    const payload = parseOrThrow(declarationGenerateSchema, request.body);
    const record = await declarationService.generateDeclaration(app.prisma, payload.ddId, request.user.sub);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'generate_eudr_declaration',
      targetType: 'eudr_due_diligence',
      targetId: payload.ddId,
      requestId: request.id
    });

    return successEnvelope(record);
  });

  app.post('/declarations/submit', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE, USER_ROLES.EXPORTER])]
  }, async (request) => {
    const payload = parseOrThrow(declarationSubmitSchema, request.body);
    const record = await declarationService.submitDeclaration(
      app.prisma,
      payload.ddId,
      request.user.sub,
      payload.referenceNo
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'submit_eudr_declaration',
      targetType: 'eudr_due_diligence',
      targetId: payload.ddId,
      requestId: request.id,
      details: { referenceNo: payload.referenceNo }
    });

    return successEnvelope(record);
  });
};
