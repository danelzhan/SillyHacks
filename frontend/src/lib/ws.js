const WS_URLS = ["ws://127.0.0.1:8787/ws", "ws://localhost:8787/ws"];

export function connectWs(onMessage) {
  let urlIndex = 0;

  function tryConnect() {
    const socket = new WebSocket(WS_URLS[urlIndex]);

    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch {
        // ignore malformed payloads
      }
    };

    socket.onclose = () => {
      urlIndex = (urlIndex + 1) % WS_URLS.length;
      setTimeout(() => {
        const next = tryConnect();
        Object.assign(handle, { _socket: next });
      }, 3000);
    };

    return socket;
  }

  const handle = {
    _socket: tryConnect(),
    addEventListener(type, fn) {
      this._socket.addEventListener(type, fn);
    },
    close() {
      this._socket.onclose = null;
      this._socket.close();
    }
  };

  return handle;
}
