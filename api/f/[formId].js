const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FORM_OWNERS = {
  'contact-main': process.env.DEST_EMAIL
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const recipientEmail = FORM_OWNERS[req.query.formId];
  if (!recipientEmail) return res.status(404).json({ error: 'Unknown Form ID' });

  const { _honeypot, _redirect, ...formData } = req.body || {};
  if (_honeypot) return _redirect ? res.redirect(302, _redirect) : res.status(200).json({ ok: true });

  const html = Object.entries(formData)
    .map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`)
    .join('');

  const { error } = await resend.emails.send({
    from: 'WizFormSubmit <onboarding@resend.dev>',
    to: recipientEmail,
    subject: `New Submission [${req.query.formId}]`,
    html
  });

  if (error) return res.status(500).json({ error });
  if (_redirect) return res.redirect(302, _redirect);

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send('<h2>Thank you! Submitted via WizFormSubmit.</h2>');
};
