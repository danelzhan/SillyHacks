import { WebSocketServer } from "ws";

export function createWsHub(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  function broadcast(payload) {
    const message = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(message);
    }
  }

  function attachBootstrap(getBootstrapData) {
    wss.on("connection", (socket) => {
      socket.send(
        JSON.stringify({
          type: "bootstrap",
          payload: getBootstrapData()
        })
      );
    });
  }

  return { broadcast, attachBootstrap };
}
