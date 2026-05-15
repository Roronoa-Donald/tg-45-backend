const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { PrismaClient } = require('@prisma/client');
const reputationService = require('../services/reputation-service');

describe('Reputation Service', () => {
  let prisma;
  let testUserId;

  before(async () => {
    prisma = new PrismaClient();

    // Créer un utilisateur de test
    const testUser = await prisma.user.create({
      data: {
        role: 'farmer',
        name: 'Test Farmer',
        phone: '+22899999999',
        status: 'approved',
      },
    });
    testUserId = testUser.id;
  });

  after(async () => {
    // Nettoyer les données de test
    await prisma.reputationEvent.deleteMany({ where: { userId: testUserId } });
    await prisma.reputationScore.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it('should create initial score of 100', async () => {
    const score = await reputationService.getScore(prisma, testUserId);
    assert.strictEqual(score.score, 100);
    assert.strictEqual(score.isCritical, false);
  });

  it('should increase score when lot is certified', async () => {
    const result = await reputationService.recordEvent(
      prisma,
      testUserId,
      reputationService.EVENT_TYPES.LOT_CERTIFIED,
      null,
      'Test certification'
    );

    assert.strictEqual(result.score.score, 105);
    assert.strictEqual(result.event.points, 5);
    assert.strictEqual(result.isCritical, false);
  });

  it('should decrease score when lot is rejected', async () => {
    const result = await reputationService.recordEvent(
      prisma,
      testUserId,
      reputationService.EVENT_TYPES.LOT_REJECTED_BY_EXPORTER,
      null,
      'Test rejection'
    );

    assert.strictEqual(result.score.score, 95); // 105 - 10
    assert.strictEqual(result.event.points, -10);
  });

  it('should mark user as critical when score drops below 50', async () => {
    // Réduire le score à 35
    await reputationService.recordEvent(
      prisma,
      testUserId,
      reputationService.EVENT_TYPES.LOT_REJECTED_BY_EXPORTER,
      null,
      'Test 1'
    );
    await reputationService.recordEvent(
      prisma,
      testUserId,
      reputationService.EVENT_TYPES.LOT_REJECTED_BY_EXPORTER,
      null,
      'Test 2'
    );
    await reputationService.recordEvent(
      prisma,
      testUserId,
      reputationService.EVENT_TYPES.LOT_REJECTED_BY_EXPORTER,
      null,
      'Test 3'
    );
    await reputationService.recordEvent(
      prisma,
      testUserId,
      reputationService.EVENT_TYPES.LOT_REJECTED_BY_EXPORTER,
      null,
      'Test 4'
    );
    await reputationService.recordEvent(
      prisma,
      testUserId,
      reputationService.EVENT_TYPES.LOT_REJECTED_BY_EXPORTER,
      null,
      'Test 5'
    );

    const score = await reputationService.getScore(prisma, testUserId);
    assert.strictEqual(score.score, 45); // 95 - 50
    assert.strictEqual(score.isCritical, true);
  });

  it('should retrieve reputation history', async () => {
    const history = await reputationService.getHistory(prisma, testUserId, 10);

    assert.ok(history.events.length > 0);
    assert.strictEqual(history.isCritical, true);
    assert.ok(history.events[0].eventType);
  });

  it('should list critical users', async () => {
    const criticalUsers = await reputationService.getCriticalUsers(prisma);

    const foundUser = criticalUsers.find(u => u.userId === testUserId);
    assert.ok(foundUser);
    assert.strictEqual(foundUser.isCritical, true);
    assert.ok(foundUser.user.name);
  });

  it('should provide global statistics', async () => {
    const stats = await reputationService.getStatistics(prisma);

    assert.ok(stats.totalUsers >= 1);
    assert.ok(stats.criticalUsers >= 1);
    assert.ok(typeof stats.averageScore === 'number');
    assert.strictEqual(stats.threshold, 50);
  });

  it('should not allow score to go below 0', async () => {
    // Ajouter beaucoup de pénalités
    for (let i = 0; i < 10; i++) {
      await reputationService.recordEvent(
        prisma,
        testUserId,
        reputationService.EVENT_TYPES.DISPUTE_PROVEN,
        null,
        `Test dispute ${i}`
      );
    }

    const score = await reputationService.getScore(prisma, testUserId);
    assert.ok(score.score >= 0);
  });
});
