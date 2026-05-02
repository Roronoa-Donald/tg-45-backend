const { zodToJsonSchema } = require('zod-to-json-schema');
const { AppError } = require('./errors');

function jsonSchema(zodSchema) {
  return zodToJsonSchema(zodSchema, { target: 'openApi3' });
}

function parseOrThrow(zodSchema, payload) {
  const result = zodSchema.safeParse(payload);
  if (!result.success) {
    throw new AppError('validation_error', 'Validation error', 400, result.error.issues);
  }
  return result.data;
}

module.exports = { jsonSchema, parseOrThrow };
