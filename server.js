const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const EDGEGAP_TOKEN = process.env.EDGEGAP_TOKEN;
const EDGEGAP_URL = 'https://api.edgegap.com/v1/relays/sessions';

app.post('/create-session', async (req, res) => {
  try {
    const { hostIp } = req.body;
    const response = await fetch(EDGEGAP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `token ${EDGEGAP_TOKEN}` },
      body: JSON.stringify({ max_user_count: 4, users: [{ ip: hostIp }] })
    });
    const raw = await response.json();
    console.log('Edgegap create response:', response.status, JSON.stringify(raw));
    if (!response.ok) return res.status(response.status).json({ error: raw });

    // Повертаємо спрощений формат для Unity
    res.json({
      session_id: raw.session_id,
      relay_ip: raw.ip || raw.relay_ip,
      server_port: raw.ports?.server?.port ?? raw.relay_ports?.server ?? 8888,
      client_port: raw.ports?.client?.port ?? raw.relay_ports?.client ?? 9999,
      user_id: raw.users?.[0]?.user_id ?? 1
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/join-session', async (req, res) => {
  try {
    const { sessionId, clientIp } = req.body;
    // Додаємо нового гравця до існуючої сесії
    const response = await fetch(`${EDGEGAP_URL}/${sessionId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `token ${EDGEGAP_TOKEN}` },
      body: JSON.stringify({ ip: clientIp })
    });
    const raw = await response.json();
    console.log('Edgegap join response:', response.status, JSON.stringify(raw));
    if (!response.ok) return res.status(response.status).json({ error: raw });

    // Отримуємо дані всієї сесії щоб знати relay_ip і порти
    const sessResponse = await fetch(`${EDGEGAP_URL}/${sessionId}`, {
      headers: { 'Authorization': `token ${EDGEGAP_TOKEN}` }
    });
    const sessData = await sessResponse.json();
    console.log('Session data:', JSON.stringify(sessData));

    res.json({
      session_id: sessionId,
      relay_ip: sessData.ip || sessData.relay_ip,
      server_port: sessData.ports?.server?.port ?? 8888,
      client_port: sessData.ports?.client?.port ?? 9999,
      user_id: raw.user_id ?? raw.users?.slice(-1)[0]?.user_id ?? 2
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay backend running on port ${PORT}`));
