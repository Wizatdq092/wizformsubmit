const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FORM_OWNERS = {
  'contact-main': process.env.DEST_EMAIL
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeDecode(value = '') {
  try {
    return decodeURIComponent(String(value)).trim();
  } catch {
    return String(value).trim();
  }
}

function getSubmissionContext(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '');
  const ip =
    forwarded.split(',')[0].trim() ||
    String(req.headers['x-real-ip'] || '').trim() ||
    'Unknown';

  const city = safeDecode(req.headers['x-vercel-ip-city'] || '');
  const region = safeDecode(req.headers['x-vercel-ip-country-region'] || '');
  const country = safeDecode(req.headers['x-vercel-ip-country'] || '');
  const location = [city, region, country].filter(Boolean).join(', ') || 'Unknown';

  return { ip, location };
}

function isSafeRedirectUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Missing RESEND_API_KEY' });
  }

  const formId = String(req.query.formId || '').trim();
  const recipientEmail = FORM_OWNERS[formId];
  if (!recipientEmail) {
    return res.status(404).json({ error: 'Unknown Form ID' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { _honeypot, _redirect, _subject, ...rawFields } = body;
  const wantsJson = (req.headers.accept || '').includes('application/json');

  if (_honeypot) {
    if (_redirect && isSafeRedirectUrl(_redirect) && !wantsJson) {
      return res.redirect(302, _redirect);
    }
    return res.status(200).json({ ok: true });
  }

  const entries = Object.entries(rawFields)
    .map(([key, val]) => [
      String(key),
      Array.isArray(val) ? val.join(', ') : String(val ?? '')
    ])
    .filter(([key]) => key.length > 0);

  if (entries.length === 0) {
    return res.status(400).json({ error: 'No form fields submitted.' });
  }

  const emailEntry = entries.find(([k]) => k.toLowerCase() === 'email');
  const emailLabel = emailEntry ? emailEntry[1] : 'Unknown';
  const { ip, location } = getSubmissionContext(req);

  const allRows = [
    ...entries,
    ['IP Address', ip],
    ['Approximate Location', location]
  ];

  const plainTextBlock = allRows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const rowsHtml = allRows
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;width:180px;">${escapeHtml(k)}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;white-space:pre-wrap;">${escapeHtml(v)}</td>
        </tr>`
    )
    .join('');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;color:#111827;">
      <h2 style="margin:0 0 12px;font-size:18px;">Submission for ${escapeHtml(emailLabel)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${rowsHtml}
      </table>
    </div>
  `;

  const subject = _subject
    ? String(_subject).replace(/[\r\n]/g, ' ').trim().slice(0, 120)
    : `Form Submission (${formId}) - ${emailLabel}`;

  const { error } = await resend.emails.send({
    from: 'WizFormSubmit <onboarding@resend.dev>',
    to: recipientEmail,
    subject,
    text: plainTextBlock,
    html
  });

  if (error) {
    return res.status(502).json({ error: 'Failed to send submission email.' });
  }

  if (wantsJson) {
    return res.status(200).json({ ok: true });
  }

  if (_redirect && isSafeRedirectUrl(_redirect)) {
    return res.redirect(302, _redirect);
  }

  return res.status(204).end();
};
