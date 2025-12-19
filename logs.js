export function initLogWebSocket(wss) {
  function broadcast(message) {
    const payload = JSON.stringify({
      timestamp: new Date().toLocaleTimeString(),
      message
    });

    wss.clients.forEach(client => {
      if (client.readyState === 1) client.send(payload);
    });
  }

  setInterval(() => broadcast("AI-Lab heartbeat OK"), 10000);
  return broadcast;
}

