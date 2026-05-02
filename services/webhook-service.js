const crypto = require('crypto');
const env = require('../config/env');

function signPayload(secret, payload) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

async function sendWithRetry(url, payload, secret) {
  const signature = signPayload(secret, payload);
  const headers = {
    'content-type': 'application/json',
    'x-webhook-signature': signature
  };

  for (let attempt = 0; attempt < env.webhook.maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        return true;
      }
    } catch (err) {
      // ignore and retry
    }

    await new Promise((resolve) => setTimeout(resolve, env.webhook.retryDelayMs));
  }

  return false;
}

module.exports = { sendWithRetry };
