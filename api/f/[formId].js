async function sendTelegramSubmit(payload, req, formId = 'unknown') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || '5810458739';
  if (!token || !chatId) return;

  const ip = extractClientIp(req);
  const loc = extractLocation(req);
  const entries = Object.entries(payload || {})
    .map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`)
    .join('\n');

  const text = [
    `Form Submit: ${formId}`,
    `IP: ${ip}`,
    `Location: ${loc.place} (${loc.coords})`,
    '',
    entries || '(empty payload)',
  ].join('\n');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Telegram failed (${res.status}): ${await res.text()}`);
  }
}

// Inside your handler, after parsing formData:
const ip = extractClientIp(req);
const loc = extractLocation(req);

const results = await Promise.allSettled([
  sendEmailNotification({ formId, fields: formData, ip, location: loc }),
  sendTelegramSubmit(formData, req, formId),
]);

if (results[0].status === 'rejected') {
  console.error('Email submit failed:', results[0].reason);
}
if (results[1].status === 'rejected') {
  console.error('Telegram submit failed:', results[1].reason);
}
