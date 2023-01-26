// server.js
import express from 'express';
import path from 'path';
import serveStatic from 'serve-static';
//import bodyParser from 'body-parser';
import * as WebSocket from 'ws';
import { createServer } from 'http';

var app = express();

var __dirname = path.resolve();

app.use(serveStatic(__dirname + "/dist"));
//app.use(bodyParser.json());

const server = createServer(app);

const wss = new WebSocket.WebSocketServer({ server });

console.log('Websocket server started');

wss.on('connection', function (ws) {
    console.log('Client connected');
    ws.on('message', function (message) {
        // Broadcast any received message to all clients
        //console.log('received: %s', message);
        var data = JSON.parse(message);
        if (data['ready']) {
            console.log('Player ' + data['ready'] + ' is ready for AR');
        }
        
        wss.broadcast(message);
    });
});

wss.broadcast = function (data) {
    this.clients.forEach(function (client) {
        if (client.readyState === 1) {
            client.send(data.toString());
        }
    });
};

server.listen(process.env.PORT || 3001, () => {
    console.log(`Server running at http://127.0.0.1:${server.address().port}/`);
});