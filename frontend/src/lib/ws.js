const WS_URL = "ws://localhost:8787/ws";

export function connectWs(onMessage) {
  const socket = new WebSocket(WS_URL);
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      onMessage(payload);
    } catch {
      // ignore malformed payloads
    }
  };
  return socket;
}
