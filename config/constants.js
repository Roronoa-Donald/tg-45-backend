const USER_ROLES = {
  FARMER: 'farmer',
  COOPERATIVE: 'cooperative',
  EXPORTER: 'exporter',
  VERIFIER: 'verifier',
  SUPPORT: 'support',
  ADMIN: 'admin'
};

const LOT_STATUS = {
  REGISTERED: 'registered',
  VALIDATED: 'validated',
  CERTIFIED: 'certified',
  SHIPPED: 'shipped'
};

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const EXPORT_STATUS = {
  DECLARED: 'declared',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered'
};

const LOT_EVENT_TYPES = {
  REGISTER: 'register_lot',
  UPDATE: 'update_lot',
  TRANSFER: 'transfer_lot',
  MEDIA_UPLOAD: 'upload_image',
  VERIFY: 'verify_lot',
  CERTIFY: 'certify_lot'
};

const EXPORT_EVENT_TYPES = {
  CREATED: 'export_created',
  STATUS_UPDATE: 'export_status_update'
};

module.exports = {
  USER_ROLES,
  LOT_STATUS,
  VERIFICATION_STATUS,
  EXPORT_STATUS,
  LOT_EVENT_TYPES,
  EXPORT_EVENT_TYPES
};
