module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = 'nicholas.alkema@catalyst-labs.com';

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing RESEND_API_KEY' });
  }

  let body = '';
  await new Promise((resolve) => {
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', resolve);
  });

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { name, business, phone, email, trade, missedCalls, notes } = data;

  if (!name || !business || !phone || !email || !trade || !missedCalls) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PlumTech <onboarding@resend.dev>',
        to: [toEmail],
        subject: `New Demo Request: ${business} (${trade})`,
        html: `
          <h2>New PlumTech Demo Request</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;font-size:15px;">
            <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Name</td><td style="padding:8px 0;">${name}</td></tr>
            <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Business</td><td style="padding:8px 0;">${business}</td></tr>
            <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Phone</td><td style="padding:8px 0;"><a href="tel:${phone}">${phone}</a></td></tr>
            <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Trade</td><td style="padding:8px 0;">${trade}</td></tr>
            <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Missed Calls/Week</td><td style="padding:8px 0;">${missedCalls}</td></tr>
            ${notes ? `<tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555;">Notes</td><td style="padding:8px 0;">${notes}</td></tr>` : ''}
          </table>
        `,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Resend error:', response.status, err);
      return res.status(502).json({ error: 'Failed to send email' });
    }

    const result = await response.json();
    console.log(`[PlumTech] Email sent to ${toEmail} — ${name} / ${business} / ${phone} / ${trade} (Resend ID: ${result.id})`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email send failed:', err);
    return res.status(500).json({ error: err.message });
  }
};
