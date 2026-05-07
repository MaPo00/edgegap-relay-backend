const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const EDGEGAP_TOKEN = process.env.EDGEGAP_TOKEN; // токен з env variable
const EDGEGAP_URL = 'https://api.edgegap.com/v1/relays/sessions';

// Створення сесії (хост викликає)
app.post('/create-session', async (req, res) => {
  try {
    const { hostIp } = req.body;
    
    const response = await fetch(EDGEGAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${EDGEGAP_TOKEN}`
      },
      body: JSON.stringify({
        max_user_count: 4,
        users: [{ ip: hostIp }]
      })
    });

    const data = await response.json();
    console.log('Edgegap response:', response.status, JSON.stringify(data));
    
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }
    
    res.json(data); // session_id, users[0].authorization_token, relay_ip, relay_port
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Приєднання до сесії (клієнт викликає)
app.post('/join-session', async (req, res) => {
  try {
    const { sessionId, clientIp } = req.body;

    // Додаємо гравця до існуючої сесії
    const response = await fetch(`${EDGEGAP_URL}/${sessionId}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${EDGEGAP_TOKEN}`
      },
      body: JSON.stringify({ ip: clientIp })
    });

    const data = await response.json();
    console.log('Join response:', response.status, JSON.stringify(data));

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    res.json(data); // authorization_token для цього гравця
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay backend running on port ${PORT}`));