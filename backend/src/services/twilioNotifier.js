function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildStatusMessage({ pet, event, note } = {}) {
  const health = Math.max(0, Math.min(100, Number(pet?.health ?? 0)));
  const status = pet?.status ?? "unknown";
  const eventType = event?.type ?? "none";
  const domain = event?.domain ? ` @ ${event.domain}` : "";
  const suffix = note ? ` Note: ${note}.` : "";

  return `Doomagotchi status is ${status} at ${health}%. Latest event: ${eventType}${domain}.${suffix}`;
}

export function createTwilioNotifier(config = {}) {
  const accountSid = trimString(config.accountSid ?? process.env.TWILIO_ACCOUNT_SID);
  const authToken = trimString(config.authToken ?? process.env.TWILIO_AUTH_TOKEN);
  const fromNumber = trimString(config.fromNumber ?? process.env.TWILIO_FROM_NUMBER);
  const toNumber = trimString(config.toNumber ?? process.env.TWILIO_TO_NUMBER);
  const cooldownMs = Number(config.cooldownMs ?? 20_000);
  let armed = Boolean(config.initialArmed ?? true);
  let lastSentAt = 0;

  function isConfigured() {
    return Boolean(accountSid && authToken && fromNumber && toNumber);
  }

  function isArmed() {
    return armed;
  }

  function setArmed(nextArmed) {
    armed = Boolean(nextArmed);
    return armed;
  }

  function isOnCooldown() {
    return Date.now() - lastSentAt < cooldownMs;
  }

  function cooldownRemainingMs() {
    return Math.max(0, cooldownMs - (Date.now() - lastSentAt));
  }

  async function sendStatusNotification({ pet, event, note, body } = {}) {
    if (!isConfigured()) {
      return {
        ok: false,
        sent: false,
        configured: false,
        reason: "Twilio is not configured."
      };
    }

    if (!armed) {
      return {
        ok: false,
        sent: false,
        configured: true,
        armed: false,
        reason: "Twilio notifications are turned off."
      };
    }

    if (isOnCooldown()) {
      return {
        ok: false,
        sent: false,
        configured: true,
        armed: true,
        retryAfterMs: cooldownRemainingMs(),
        reason: "Twilio notification cooldown is active."
      };
    }

    const messageBody = typeof body === "string" && body.trim() ? body.trim() : buildStatusMessage({ pet, event, note });
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
    const authorization = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const payload = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: messageBody
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: payload
    });

    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      throw new Error(parsed?.message ?? text ?? "Failed to send Twilio message.");
    }

    lastSentAt = Date.now();

    return {
      ok: true,
      sent: true,
      configured: true,
      armed: true,
      sid: parsed?.sid ?? null
    };
  }

  return {
    isConfigured,
    isArmed,
    setArmed,
    isOnCooldown,
    cooldownRemainingMs,
    sendStatusNotification,
    buildStatusMessage
  };
}
