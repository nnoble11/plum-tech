module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!agentId || !apiKey) {
    return res.status(500).json({ error: 'Server is missing ElevenLabs credentials' });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey } }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('ElevenLabs error:', response.status, text);
      return res.status(502).json({ error: 'ElevenLabs API error', status: response.status });
    }

    const body = await response.json();
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(body.signed_url);
  } catch (err) {
    console.error('Signed URL fetch failed:', err);
    return res.status(500).json({ error: err.message });
  }
};
