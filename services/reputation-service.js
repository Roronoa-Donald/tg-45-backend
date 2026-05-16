const { AppError } = require('../utils/errors');

const EVENT_TYPES = {
  LOT_CERTIFIED: 'lot_certified',
  LOT_REJECTED_BY_EXPORTER: 'lot_rejected_by_exporter',
  DISPUTE_PROVEN: 'dispute_proven',
};

const EVENT_POINTS = {
  [EVENT_TYPES.LOT_CERTIFIED]: 5,
  [EVENT_TYPES.LOT_REJECTED_BY_EXPORTER]: -10,
  [EVENT_TYPES.DISPUTE_PROVEN]: -20,
};

const CRITICAL_THRESHOLD = 50;

/**
 * Initialize or get reputation score for a user
 */
async function getOrCreateScore(prisma, userId) {
  let score = await prisma.reputationScore.findUnique({
    where: { userId },
  });

  if (!score) {
    score = await prisma.reputationScore.create({
      data: {
        userId,
        score: 100,
      },
    });
  }

  return score;
}

/**
 * Record a reputation event and update score
 */
async function recordEvent(prisma, userId, eventType, lotId = null, reason = null) {
  const change = EVENT_POINTS[eventType];

  if (change === undefined) {
    throw new AppError('invalid_event_type', `Invalid reputation event type: ${eventType}`, 400);
  }

  // Create reputation event
  const event = await prisma.reputationEvent.create({
    data: {
      userId,
      eventType,
      points: change,
      lotId,
      description: reason,
    },
  });

  // Get or create score
  let score = await getOrCreateScore(prisma, userId);

  // Update score
  const newScore = Math.max(0, score.score + change); // Cannot go below 0
  const previousScore = score.score;

  score = await prisma.reputationScore.update({
    where: { userId },
    data: {
      score: newScore,
    },
  });

  // Check if score is critical (below threshold)
  const isCritical = newScore <= CRITICAL_THRESHOLD;

  // Si score critique, notifier
  if (isCritical && previousScore > CRITICAL_THRESHOLD) {
    console.warn(`[REPUTATION] User ${userId} reputation dropped to critical level: ${newScore}`);
    // TODO: Notification au ministère via système de notification
  }

  return {
    event,
    score,
    previousScore,
    isCritical,
    threshold: CRITICAL_THRESHOLD,
  };
}

/**
 * Get reputation score for a user
 */
async function getScore(prisma, userId) {
  const score = await getOrCreateScore(prisma, userId);

  const isCritical = score.score <= CRITICAL_THRESHOLD;

  return {
    ...score,
    isCritical,
    threshold: CRITICAL_THRESHOLD,
  };
}

/**
 * Get reputation history for a user
 */
async function getHistory(prisma, userId, limit = 50) {
  const events = await prisma.reputationEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      lot: {
        select: {
          id: true,
          lotCode: true,
          product: true,
          status: true,
        },
      },
    },
  });

  const score = await getOrCreateScore(prisma, userId);

  return {
    score,
    events,
    isCritical: score.score <= CRITICAL_THRESHOLD,
  };
}

/**
 * Get users with critical reputation scores
 */
async function getCriticalUsers(prisma) {
  const criticalScores = await prisma.reputationScore.findMany({
    where: {
      score: {
        lt: CRITICAL_THRESHOLD,
      },
    },
    orderBy: {
      score: 'asc',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  return criticalScores.map(s => ({
    ...s,
    isCritical: true,
    threshold: CRITICAL_THRESHOLD,
  }));
}

/**
 * Get reputation statistics
 */
async function getStatistics(prisma) {
  const totalUsers = await prisma.reputationScore.count();
  const criticalUsers = await prisma.reputationScore.count({
    where: { score: { lt: CRITICAL_THRESHOLD } },
  });

  const avgScore = await prisma.reputationScore.aggregate({
    _avg: { score: true },
  });

  const recentEvents = await prisma.reputationEvent.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
  });

  return {
    totalUsers,
    criticalUsers,
    averageScore: avgScore._avg.score || 0,
    recentEventsLast7Days: recentEvents,
    threshold: CRITICAL_THRESHOLD,
  };
}

/**
 * Get reputation with level
 */
async function getReputation(prisma, userId) {
  const score = await getOrCreateScore(prisma, userId);
  const isCritical = score.score <= CRITICAL_THRESHOLD;

  // Calculate level based on score
  let level = 'Debutant';
  if (score.score >= 200) level = 'Expert';
  else if (score.score >= 150) level = 'Avance';
  else if (score.score >= 100) level = 'Intermediaire';
  else if (score.score >= 50) level = 'Novice';
  else level = 'Critique';

  return {
    userId: score.userId,
    score: score.score,
    level,
    isCritical,
    threshold: CRITICAL_THRESHOLD,
    updatedAt: score.updatedAt
  };
}

/**
 * Get reputation history with pagination
 */
async function getReputationHistory(prisma, userId, pagination = { page: 1, pageSize: 20 }) {
  const skip = (pagination.page - 1) * pagination.pageSize;

  const [total, events] = await Promise.all([
    prisma.reputationEvent.count({ where: { userId } }),
    prisma.reputationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pagination.pageSize,
      include: {
        lot: {
          select: {
            id: true,
            lotCode: true,
            product: true,
            status: true
          }
        }
      }
    })
  ]);

  return { events, total };
}

/**
 * Get leaderboard (top performers)
 */
async function getLeaderboard(prisma, limit = 10, role = null) {
  const where = role ? { user: { role } } : {};

  const topScores = await prisma.reputationScore.findMany({
    where,
    orderBy: { score: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true
        }
      }
    }
  });

  return topScores.map((s, index) => ({
    rank: index + 1,
    userId: s.userId,
    userName: s.user.name,
    userRole: s.user.role,
    score: s.score,
    updatedAt: s.updatedAt
  }));
}

module.exports = {
  EVENT_TYPES,
  EVENT_POINTS,
  CRITICAL_THRESHOLD,
  getOrCreateScore,
  recordEvent,
  getScore,
  getReputation,
  getHistory,
  getReputationHistory,
  getLeaderboard,
  getCriticalUsers,
  getStatistics,
};
