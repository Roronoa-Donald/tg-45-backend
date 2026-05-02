const { AppError } = require('../utils/errors');
const cooperativeRepository = require('../repositories/cooperative-repository');

async function create(prisma, payload) {
  return cooperativeRepository.createCooperative(prisma, payload);
}

async function addMember(prisma, cooperativeId, userId, role) {
  return cooperativeRepository.addMember(prisma, cooperativeId, userId, role);
}

async function removeMember(prisma, cooperativeId, userId) {
  try {
    return await cooperativeRepository.removeMember(prisma, cooperativeId, userId);
  } catch (err) {
    throw new AppError('not_found', 'Membership not found', 404);
  }
}

async function listMembers(prisma, cooperativeId) {
  return cooperativeRepository.getMembers(prisma, cooperativeId);
}

module.exports = {
  create,
  addMember,
  removeMember,
  listMembers
};
