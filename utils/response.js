function successEnvelope(data, meta) {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {})
  };
}

function errorEnvelope(code, message, details, requestId) {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(requestId ? { requestId } : {})
    }
  };
}

module.exports = { successEnvelope, errorEnvelope };
