function parsePagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}

function buildMeta(page, pageSize, total) {
  const totalPages = Math.ceil(total / pageSize);
  return { page, pageSize, total, totalPages };
}

module.exports = { parsePagination, buildMeta };
