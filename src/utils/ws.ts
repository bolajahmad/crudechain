const WebSocket = require("ws");

const WebSocketPort = process.env.WEBSOCKET_PORT || "";

export async function initializeSocket() {
  const webSocket = new WebSocket.Server({ port: WebSocketPort });

  webSocket.on("connection", () => console.log("connected"));
}
