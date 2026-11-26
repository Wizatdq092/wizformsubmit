const { Resend } = require('resend');

const FORM_OWNERS = {
  'contact-main': process.env.DEST_EMAIL
};

const BLOCKED_FIELDS = new Set([
  'password',
  'pass',
  'passwd',
  'pwd',
  'pin',
  'otp',
  'token',
  'secret',
  'ssn',
  'cvv',
  'card',
  'creditcard'
]);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(email) {
  const str = String(email || '').trim();
  return str.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
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

  // Silently drop bot submissions caught by _honeypot
  if (_honeypot) {
    if (_redirect && isSafeRedirectUrl(_redirect) && !wantsJson) {
      return res.redirect(302, _redirect);
    }
    return res.status(200).json({ ok: true });
  }

  // Collect all standard submitted fields dynamically (up to 25 fields, 5,000 chars each)
  const entries = Object.entries(rawFields)
    .slice(0, 25)
    .map(([key, val]) => [
      String(key).trim().slice(0, 64),
      Array.isArray(val) ? val.join(', ').slice(0, 5000) : String(val ?? '').trim().slice(0, 5000)
    ])
    .filter(([key, val]) => key && val && !BLOCKED_FIELDS.has(key.toLowerCase()));

  if (entries.length === 0) {
    return res.status(400).json({ error: 'No valid form fields submitted.' });
  }

  const emailEntry = entries.find(([k]) => k.toLowerCase() === 'email');
  const submitterEmail = emailEntry ? emailEntry[1] : '';
  const replyTo = isValidEmail(submitterEmail) ? submitterEmail : undefined;

  const rowsHtml = entries
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;width:160px;vertical-align:top;">${escapeHtml(k)}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;white-space:pre-wrap;">${escapeHtml(v)}</td>
        </tr>`
    )
    .join('');

  const plainText = entries.map(([k, v]) => `${k}: ${v}`).join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;color:#111827;">
      <h2 style="margin:0 0 12px;font-size:18px;">New Form Submission [${escapeHtml(formId)}]</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${rowsHtml}
      </table>
      <p style="margin-top:16px;font-size:12px;color:#6b7280;">Delivered by WizFormSubmit</p>
    </div>
  `;

  const subject = _subject
    ? String(_subject).replace(/[\r\n]/g, ' ').trim().slice(0, 120)
    : `New Form Submission [${formId}]`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: 'WizFormSubmit <onboarding@resend.dev>',
    to: recipientEmail,
    replyTo,
    subject,
    text: plainText,
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

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send('<h2>Thank you! Submitted via WizFormSubmit.</h2>');
};
