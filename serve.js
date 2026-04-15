const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  });
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
};

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const API_KEY = process.env.ELEVENLABS_API_KEY;

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/signed-url' && req.method === 'GET') {
    if (!AGENT_ID || !API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing ELEVENLABS_AGENT_ID or ELEVENLABS_API_KEY' }));
      return;
    }
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${AGENT_ID}`,
        { headers: { 'xi-api-key': API_KEY } }
      );
      if (!response.ok) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ElevenLabs API error' }));
        return;
      }
      const body = await response.json();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(body.signed_url);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/contact' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing RESEND_API_KEY' }));
        return;
      }
      let data;
      try { data = JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      const { name, business, phone, email, trade, missedCalls, notes } = data;
      if (!name || !business || !phone || !email || !trade || !missedCalls) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields' }));
        return;
      }
      try {
        const toEmail = 'nicholas.alkema@catalyst-labs.com';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PlumTech <onboarding@resend.dev>',
            to: [toEmail],
            subject: `New Demo Request: ${business} (${trade})`,
            html: `<h2>New PlumTech Demo Request</h2>
              <table style="border-collapse:collapse;font-family:sans-serif;font-size:15px;">
                <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Name</td><td>${name}</td></tr>
                <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Business</td><td>${business}</td></tr>
                <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Phone</td><td><a href="tel:${phone}">${phone}</a></td></tr>
                <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
                <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Trade</td><td>${trade}</td></tr>
                <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Missed Calls/Week</td><td>${missedCalls}</td></tr>
                ${notes ? `<tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Notes</td><td>${notes}</td></tr>` : ''}
              </table>`,
          }),
        });
        if (!response.ok) {
          const err = await response.text();
          console.error('Resend error:', response.status, err);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to send email' }));
          return;
        }
        const result = await response.json();
        console.log(`[PlumTech] Email sent to ${toEmail} — ${name} / ${business} / ${phone} / ${trade} (Resend ID: ${result.id})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Email send failed:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  const filePath = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Serving on http://localhost:${PORT}`);
  if (!AGENT_ID || !API_KEY) {
    console.warn('\n⚠  ELEVENLABS_AGENT_ID and ELEVENLABS_API_KEY are not set.');
    console.warn('   The live demo call button will not work without them.');
    console.warn('   Run with: node --env-file=.env serve.js\n');
  }
});
