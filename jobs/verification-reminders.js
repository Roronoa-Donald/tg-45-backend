const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const REMINDER_HOURS = 48;
const ESCALATION_HOURS = 72;

/**
 * Send reminders to verifiers for lots pending vote for 48+ hours
 */
async function sendVerificationReminders() {
  const reminderCutoff = new Date(Date.now() - REMINDER_HOURS * 60 * 60 * 1000);

  try {
    // Find lots pending vote for more than 48 hours
    const lotsNeedingReminder = await prisma.lot.findMany({
      where: {
        verificationStatus: 'pending_vote',
        voteDeadline: {
          lte: reminderCutoff
        },
        verifications: {
          some: {
            vote: null,
            reminderSentAt: null // Haven't sent reminder yet
          }
        }
      },
      include: {
        verifications: {
          where: {
            vote: null,
            reminderSentAt: null
          },
          include: {
            verifier: {
              select: { id: true, name: true, email: true, phone: true }
            }
          }
        },
        owner: {
          select: { name: true }
        }
      }
    });

    // eslint-disable-next-line no-console
    console.log(`[Reminder Job] Found ${lotsNeedingReminder.length} lots needing reminders`);

    for (const lot of lotsNeedingReminder) {
      for (const verification of lot.verifications) {
        // Mark reminder as sent
        await prisma.lotVerification.update({
          where: { id: verification.id },
          data: { reminderSentAt: new Date() }
        });

        // TODO: Send actual notification (email/SMS)
        // For now, just log
        // eslint-disable-next-line no-console
        console.log(`[Reminder] Sent reminder to ${verification.verifier.name} for lot ${lot.lotCode}`);

        // Example: Send email
        // await sendEmail({
        //   to: verification.verifier.email,
        //   subject: `Rappel: Vote requis pour le lot ${lot.lotCode}`,
        //   body: `Bonjour ${verification.verifier.name},\n\n` +
        //         `Le lot ${lot.lotCode} (${lot.owner.name}) attend votre vote depuis plus de 48h.\n` +
        //         `Veuillez vous connecter pour voter avant l'escalade (72h).`
        // });
      }
    }

    return { reminded: lotsNeedingReminder.length };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Reminder Job] Error:', error);
    throw error;
  }
}

/**
 * Escalate lots pending vote for 72+ hours to Ministry
 */
async function escalateStalledVerifications() {
  const escalationCutoff = new Date(Date.now() - ESCALATION_HOURS * 60 * 60 * 1000);

  try {
    // Find lots pending vote for more than 72 hours
    const lotsToEscalate = await prisma.lot.findMany({
      where: {
        verificationStatus: 'pending_vote',
        voteDeadline: {
          lte: escalationCutoff
        },
        escalatedAt: null // Not escalated yet
      },
      include: {
        verifications: {
          include: {
            verifier: {
              select: { id: true, name: true }
            }
          }
        },
        owner: {
          select: { name: true, cooperativeId: true }
        }
      }
    });

    // eslint-disable-next-line no-console
    console.log(`[Escalation Job] Found ${lotsToEscalate.length} lots to escalate`);

    for (const lot of lotsToEscalate) {
      // Mark as escalated
      await prisma.lot.update({
        where: { id: lot.id },
        data: {
          escalatedAt: new Date(),
          verificationStatus: 'escalated'
        }
      });

      // Create lot event
      await prisma.lotEvent.create({
        data: {
          lotId: lot.id,
          eventType: 'escalated_to_ministry',
          metadata: {
            reason: 'Vote deadline exceeded (72h)',
            assignedVerifiers: lot.verifications.map(v => ({
              id: v.verifierId,
              name: v.verifier.name,
              voted: v.vote !== null
            }))
          }
        }
      });

      // TODO: Notify Ministry
      // eslint-disable-next-line no-console
      console.log(`[Escalation] Escalated lot ${lot.lotCode} to Ministry`);

      // Example: Send notification to ministry users
      // const ministryUsers = await prisma.user.findMany({
      //   where: { role: 'ministry' }
      // });
      // for (const user of ministryUsers) {
      //   await sendEmail({
      //     to: user.email,
      //     subject: `Escalade: Lot ${lot.lotCode} nécessite intervention`,
      //     body: `Le lot ${lot.lotCode} est bloqué en attente de vote depuis plus de 72h.`
      //   });
      // }
    }

    return { escalated: lotsToEscalate.length };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Escalation Job] Error:', error);
    throw error;
  }
}

/**
 * Main job runner - call this from a cron job or scheduler
 */
async function runVerificationJobs() {
  // eslint-disable-next-line no-console
  console.log(`[Job] Starting verification reminder/escalation jobs at ${new Date().toISOString()}`);

  try {
    const [reminders, escalations] = await Promise.all([
      sendVerificationReminders(),
      escalateStalledVerifications()
    ]);

    // eslint-disable-next-line no-console
    console.log(`[Job] Completed: ${reminders.reminded} reminders sent, ${escalations.escalated} escalations`);

    return {
      success: true,
      reminded: reminders.reminded,
      escalated: escalations.escalated
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Job] Failed:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
}

// If run directly: node backend/jobs/verification-reminders.js
if (require.main === module) {
  runVerificationJobs()
    .then(result => {
      // eslint-disable-next-line no-console
      console.log('[Job] Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error('[Job] Fatal error:', err);
      process.exit(1);
    });
}

module.exports = {
  sendVerificationReminders,
  escalateStalledVerifications,
  runVerificationJobs
};
