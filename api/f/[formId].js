import { Resend } from 'resend';

const FORM_OWNERS = {
  'contact-main': process.env.DEST_EMAIL,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

  // Silently ignore spam caught by the honeypot field
  if (body._honeypot) {
    return res.status(200).json({ ok: true });
  }

  // Filter out internal control fields (prefixed with _)
  const fields = Object.entries(body).filter(([key]) => !key.startsWith('_'));

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No form fields submitted' });
  }

  const textBody = fields.map(([k, v]) => `${k}: ${String(v ?? '')}`).join('\n');
  const htmlRows = fields
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #eee;">${escapeHtml(
          k
        )}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(
          String(v ?? '')
        )}</td></tr>`
    )
    .join('');

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: 'Contact Form <onboarding@resend.dev>',
      to: recipientEmail,
      subject: `New submission from ${formId}`,
      text: textBody,
      html: `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">${htmlRows}</table>`,
    });

    if (error) {
      return res.status(502).json({ ok: false, error: error.message });
    }

    // Return JSON if requested via fetch/AJAX
    if ((req.headers.accept || '').includes('application/json')) {
      return res.status(200).json({ ok: true });
    }

    // Redirect to a custom thank-you page if _redirect is provided and valid
    if (body._redirect && /^https?:\/\//i.test(body._redirect)) {
      return res.redirect(302, body._redirect);
    }

    // Default clean confirmation page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`
      <!doctype html>
      <html lang="en">
        <head><meta charset="utf-8"><title>Submission Received</title></head>
        <body style="font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;">
          <div style="text-align:center;">
            <h1>Thank you!</h1>
            <p>Your message has been sent.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to process submission' });
  }
}
