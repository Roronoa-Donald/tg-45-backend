const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const verifierId = '736149d1-b89e-4b8b-a628-80c83c7f037b';

async function recheckAssignments() {
  try {
    console.log('Checking assignments for verifier:', verifierId);
    console.log('');

    // Check parcel validations
    const parcelValidations = await prisma.parcelValidation.findMany({
      where: {
        verifierId,
        status: 'pending'
      },
      include: {
        parcel: { select: { id: true, name: true } }
      }
    });

    console.log('Parcel validations (status=pending):', parcelValidations.length);
    parcelValidations.forEach(v => {
      console.log(`  - ${v.parcel.name || 'unnamed'} (${v.id})`);
    });
    console.log('');

    // Check lot verifications
    const lotVerifications = await prisma.lotVerification.findMany({
      where: {
        verifierId,
        vote: null
      },
      include: {
        lot: { select: { lotCode: true, verificationStatus: true } }
      }
    });

    console.log('Lot verifications (vote=null):', lotVerifications.length);
    lotVerifications.forEach(v => {
      console.log(`  - ${v.lot.lotCode} (status: ${v.lot.verificationStatus})`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

recheckAssignments();
