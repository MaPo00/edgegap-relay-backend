const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const EDGEGAP_TOKEN = process.env.EDGEGAP_TOKEN;
const EDGEGAP_URL = 'https://api.edgegap.com/v1/relays/sessions';

// Чекаємо поки сесія стане ready
async function waitForReady(sessionId, maxRetries = 15, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(`${EDGEGAP_URL}/${sessionId}`, {
      headers: { 'Authorization': `token ${EDGEGAP_TOKEN}` }
    });
    const data = await res.json();
    console.log(`[${i+1}/${maxRetries}] status: ${data.status}, ready: ${data.ready}`);
    if (data.ready && data.relay) return data;
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('Timeout waiting for relay to be ready');
}

app.post('/create-session', async (req, res) => {
  try {
    const { hostIp } = req.body;
    const response = await fetch(EDGEGAP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `token ${EDGEGAP_TOKEN}` },
      body: JSON.stringify({ users: [{ ip: hostIp }] })
    });
    const created = await response.json();
    console.log('Created session:', response.status, JSON.stringify(created));
    if (!response.ok) return res.status(response.status).json({ error: created });

    // Чекаємо поки relay буде готовий
    const data = await waitForReady(created.session_id);

    res.json({
      session_id: data.session_id,
      relay_ip: data.relay.host,
      server_port: data.relay.ports.server.port,
      client_port: data.relay.ports.client.port,
      user_id: data.session_users?.[0]?.authorization_token ?? 1
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/join-session', async (req, res) => {
  try {
    const { sessionId, clientIp } = req.body;

    // Додаємо гравця
    const joinRes = await fetch(`${EDGEGAP_URL}/${sessionId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `token ${EDGEGAP_TOKEN}` },
      body: JSON.stringify({ ip: clientIp })
    });
    const joinData = await joinRes.json();
    console.log('Join response:', joinRes.status, JSON.stringify(joinData));
    if (!joinRes.ok) return res.status(joinRes.status).json({ error: joinData });

    // Чекаємо оновлену сесію з даними для нового гравця
    const data = await waitForReady(sessionId);

    // Знаходимо authorization_token для нашого IP
    const user = data.session_users?.find(u => u.ip_address === clientIp);
    const userAuthToken = user?.authorization_token ?? data.session_users?.slice(-1)[0]?.authorization_token ?? 2;

    res.json({
      session_id: data.session_id,
      relay_ip: data.relay.host,
      server_port: data.relay.ports.server.port,
      client_port: data.relay.ports.client.port,
      user_id: userAuthToken
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay backend running on port ${PORT}`));
