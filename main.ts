import express from "express";
var bodyParser = require("body-parser");
import WebSocket from "ws";
import {
  addBlock,
  Block,
  blockchain,
  generateNextBlock,
  getLatestBlock,
  isValidNewBlock,
  replaceChain,
} from "./src/blocks.utils";

var http_port = process.env.HTTP_PORT || 3001;
var p2p_port = Number(process.env.P2P_PORT) || 6001;
var initialPeers = process.env.PEERS ? process.env.PEERS.split(",") : [];

type MessageData = { type: MessageEnum; data?: any };

var sockets: WebSocket.WebSocket[] = [];
enum MessageEnum {
  QUERY_LATEST,
  QUERY_ALL,
  RESPONSE_BLOCKCHAIN,
}

var initHttpServer = () => {
  var app = express();
  app.use(bodyParser.json());

  app.get("/blocks", (_, res) => res.send(JSON.stringify(blockchain)));
  app.post("/mine-block", (req, res) => {
    var newBlock = generateNextBlock(req.body.data);
    addBlock(newBlock);
    broadcast(responseLatestMsg());
    console.log("block added: " + JSON.stringify(newBlock));
    res.send();
  });
  // app.put("/replace-chain", (req, res) => {});
  app.get("/peers", (req, res) => {
    res.send(
      sockets.map(
        (s: any) => s._socket.remoteAddress + ":" + s._socket.remotePort
      )
    );
  });
  app.post("/addPeer", (req, res) => {
    connectToPeers([req.body.peer]);
    res.send();
  });
  app.listen(http_port, () =>
    console.log("Listening http on port: " + http_port)
  );
};

var initP2PServer = () => {
  var server = new WebSocket.Server({ port: p2p_port });
  server.on("connection", (ws) => initConnection(ws));
  console.log("listening websocket p2p port on: " + p2p_port);
};

var initConnection = (ws: WebSocket.WebSocket) => {
  sockets.push(ws);
  initMessageHandler(ws);
  initErrorHandler(ws);
  write(ws, queryChainLengthMsg());
};

var initMessageHandler = (ws: WebSocket.WebSocket) => {
  ws.on("message", (data) => {
    var message = JSON.parse(data as any as string);
    console.log("Received message" + JSON.stringify(message));
    switch (message.type) {
      case MessageEnum.QUERY_LATEST:
        write(ws, responseLatestMsg());
        break;
      case MessageEnum.QUERY_ALL:
        write(ws, responseChainMsg());
        break;
      case MessageEnum.RESPONSE_BLOCKCHAIN:
        handleBlockchainResponse(message);
        break;
    }
  });
};

var initErrorHandler = (ws: WebSocket.WebSocket) => {
  var closeConnection = (ws: WebSocket.WebSocket) => {
    console.log("connection failed to peer: " + ws.url);
    sockets.splice(sockets.indexOf(ws), 1);
  };
  ws.on("close", () => closeConnection(ws));
  ws.on("error", () => closeConnection(ws));
};

var connectToPeers = (newPeers: any[]) => {
  newPeers.forEach((peer: any) => {
    var ws = new WebSocket(peer);
    ws.on("open", () => initConnection(ws));
    ws.on("error", () => {
      console.log("connection failed");
    });
  });
};

var handleBlockchainResponse = (message: MessageData) => {
  var receivedBlocks = JSON.parse(message.data).sort(
    (b1: Block, b2: Block) => b1.index - b2.index
  );
  var latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
  var latestBlockHeld = getLatestBlock();
  if (latestBlockReceived.index > latestBlockHeld.index) {
    console.log(
      "blockchain possibly behind. We got: " +
        latestBlockHeld.index +
        " Peer got: " +
        latestBlockReceived.index
    );
    if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
      console.log("We can append the received block to our chain");
      blockchain.push(latestBlockReceived);
      broadcast(responseLatestMsg());
    } else if (receivedBlocks.length === 1) {
      console.log("We have to query the chain from our peer");
      broadcast(queryAllMsg());
    } else {
      console.log("Received blockchain is longer than current blockchain");
      replaceChain(receivedBlocks);
    }
  } else {
    console.log(
      "received blockchain is not longer than current blockchain. Do nothing"
    );
  }
};

var queryChainLengthMsg = () => ({ type: MessageEnum.QUERY_LATEST });
var queryAllMsg = () => ({ type: MessageEnum.QUERY_ALL });
var responseChainMsg = () => ({
  type: MessageEnum.RESPONSE_BLOCKCHAIN,
  data: JSON.stringify(blockchain),
});
var responseLatestMsg = () => ({
  type: MessageEnum.RESPONSE_BLOCKCHAIN,
  data: JSON.stringify([getLatestBlock()]),
});

var write = (ws: WebSocket.WebSocket, message: MessageData) =>
  ws.send(JSON.stringify(message));
var broadcast = (message: any) =>
  sockets.forEach((socket) => write(socket, message));

connectToPeers(initialPeers);
initHttpServer();
initP2PServer();
