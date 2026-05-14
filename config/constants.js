const USER_ROLES = {
  FARMER: 'farmer',
  COOPERATIVE: 'cooperative',
  EXPORTER: 'exporter',
  VERIFIER: 'verifier',
  SUPPORT: 'support',
  ADMIN: 'admin',
  COMPLIANCE: 'compliance',
  MINISTRY: 'ministry'
};

const LOT_STATUS = {
  REGISTERED: 'registered',
  VALIDATED: 'validated',
  CERTIFIED: 'certified',
  EXPORTED: 'exported',
  SHIPPED: 'shipped',
  REJECTED: 'rejected'
};

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const EXPORT_STATUS = {
  DECLARED: 'declared',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  REJECTED: 'rejected'
};

const EUDR_STATUS = {
  NOT_STARTED: 'not_started',
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  SUBMITTED: 'submitted',
  REJECTED: 'rejected',
  BLOCKED: 'blocked'
};

const LOT_EVENT_TYPES = {
  REGISTER: 'register_lot',
  UPDATE: 'update_lot',
  TRANSFER: 'transfer_lot',
  MEDIA_UPLOAD: 'upload_image',
  VERIFY: 'verify_lot',
  CERTIFY: 'certify_lot',
  EUDR_STATUS_UPDATE: 'eudr_status_update',
  EUDR_DDR_CREATED: 'eudr_ddr_created',
  EUDR_DDR_APPROVED: 'eudr_ddr_approved',
  EUDR_DDR_SUBMITTED: 'eudr_ddr_submitted'
};

const EXPORT_EVENT_TYPES = {
  CREATED: 'export_created',
  STATUS_UPDATE: 'export_status_update',
  EUDR_STATUS_UPDATE: 'eudr_status_update',
  EUDR_DDR_SUBMITTED: 'eudr_ddr_submitted'
};

module.exports = {
  USER_ROLES,
  LOT_STATUS,
  VERIFICATION_STATUS,
  EXPORT_STATUS,
  EUDR_STATUS,
  LOT_EVENT_TYPES,
  EXPORT_EVENT_TYPES
};
