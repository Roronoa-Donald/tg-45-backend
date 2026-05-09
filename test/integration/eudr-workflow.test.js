const test = require('node:test');
const assert = require('node:assert/strict');

const { AppError } = require('../../utils/errors');
const { EUDR_STATUS, LOT_STATUS, EXPORT_STATUS } = require('../../config/constants');
const ddrService = require('../../services/eudr-ddr-service');
const exportService = require('../../services/export-service');

function createMemoryPrisma() {
  const state = {
    lots: [],
    lotEvents: [],
    exports: [],
    exportEvents: [],
    exportLots: [],
    dueDiligence: [],
    declarations: [],
  };

  const prisma = {
    lot: {
      findUnique: async ({ where }) => state.lots.find((lot) => lot.id === where.id) || null,
      findMany: async ({ where }) => {
        if (where?.id?.in) {
          return state.lots.filter((lot) => where.id.in.includes(lot.id));
        }
        return [...state.lots];
      },
      update: async ({ where, data }) => {
        const lot = state.lots.find((record) => record.id === where.id);
        if (!lot) {
          throw new Error('Lot not found');
        }
        Object.assign(lot, data);
        return lot;
      },
      updateMany: async ({ where, data }) => {
        const ids = where?.id?.in || [];
        let count = 0;
        state.lots.forEach((lot) => {
          if (ids.includes(lot.id)) {
            Object.assign(lot, data);
            count += 1;
          }
        });
        return { count };
      }
    },
    lotEvent: {
      create: async ({ data }) => {
        const record = { id: `event-${state.lotEvents.length + 1}`, ...data };
        state.lotEvents.push(record);
        return record;
      }
    },
    export: {
      create: async ({ data }) => {
        const record = { id: `exp-${state.exports.length + 1}`, ...data };
        state.exports.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        const record = state.exports.find((entry) => entry.id === where.id);
        if (!record) {
          throw new Error('Export not found');
        }
        Object.assign(record, data);
        return record;
      },
      findUnique: async ({ where }) => state.exports.find((entry) => entry.id === where.id) || null
    },
    exportLot: {
      createMany: async ({ data }) => {
        data.forEach((item) => state.exportLots.push(item));
        return { count: data.length };
      }
    },
    exportEvent: {
      create: async ({ data }) => {
        const record = { id: `exp-event-${state.exportEvents.length + 1}`, ...data };
        state.exportEvents.push(record);
        return record;
      }
    },
    eudrDueDiligence: {
      findFirst: async ({ where }) => state.dueDiligence.find((dd) => {
        if (where.lotId && dd.lotId !== where.lotId) return false;
        if (where.exportId && dd.exportId !== where.exportId) return false;
        return true;
      }) || null,
      findUnique: async ({ where }) => state.dueDiligence.find((dd) => dd.id === where.id) || null,
      create: async ({ data }) => {
        const record = { id: `dd-${state.dueDiligence.length + 1}`, ...data };
        state.dueDiligence.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        const record = state.dueDiligence.find((dd) => dd.id === where.id);
        if (!record) {
          throw new Error('DDR not found');
        }
        Object.assign(record, data);
        return record;
      }
    },
    eudrDeclaration: {
      findFirst: async ({ where }) => {
        const items = state.declarations.filter((decl) => decl.ddId === where.ddId);
        return items[items.length - 1] || null;
      },
      create: async ({ data }) => {
        const record = { id: `decl-${state.declarations.length + 1}`, createdAt: new Date(), ...data };
        state.declarations.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        const record = state.declarations.find((decl) => decl.id === where.id);
        if (!record) {
          throw new Error('Declaration not found');
        }
        Object.assign(record, data);
        return record;
      }
    },
    webhookSubscription: {
      findMany: async () => []
    },
    $transaction: async (fn) => fn(prisma)
  };

  return { prisma, state };
}

test('DDR workflow updates lot EUDR status', async () => {
  const { prisma, state } = createMemoryPrisma();
  const lotId = 'lot-1';
  state.lots.push({ id: lotId, status: LOT_STATUS.CERTIFIED, eudrStatus: EUDR_STATUS.NOT_STARTED });

  const dd = await ddrService.createDueDiligence(prisma, { lotId }, 'user-1');
  assert.equal(dd.status, EUDR_STATUS.DRAFT);
  assert.equal(state.lots[0].eudrStatus, EUDR_STATUS.DRAFT);

  const approved = await ddrService.approveDueDiligence(prisma, dd.id, 'compliance-1', true);
  assert.equal(approved.status, EUDR_STATUS.APPROVED);
  assert.equal(state.lots[0].eudrStatus, EUDR_STATUS.APPROVED);

  const submitted = await ddrService.markSubmitted(prisma, dd.id, 'compliance-1', 'REF-2026-001');
  assert.equal(submitted.status, EUDR_STATUS.SUBMITTED);
  assert.equal(state.lots[0].eudrStatus, EUDR_STATUS.SUBMITTED);
  assert.ok(state.lotEvents.length >= 3);
});

test('export blocked when lot EUDR dossier not approved', async () => {
  const { prisma, state } = createMemoryPrisma();
  state.lots.push({ id: 'lot-1', status: LOT_STATUS.CERTIFIED, eudrStatus: EUDR_STATUS.DRAFT });

  await assert.rejects(
    () => exportService.declareExport(prisma, 'exporter-1', { lotIds: ['lot-1'] }),
    (err) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.code, 'eudr_not_ready');
      return true;
    }
  );
});

test('export allowed when lot EUDR dossier approved', async () => {
  const { prisma, state } = createMemoryPrisma();
  state.lots.push({ id: 'lot-1', status: LOT_STATUS.CERTIFIED, eudrStatus: EUDR_STATUS.APPROVED });

  const record = await exportService.declareExport(prisma, 'exporter-1', { lotIds: ['lot-1'] });
  assert.equal(record.status, EXPORT_STATUS.DECLARED);
  assert.equal(state.lots[0].status, 'certified;shipped');
});
