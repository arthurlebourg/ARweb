// server.js
import express from 'express';
import path, { resolve } from 'path';
import serveStatic from 'serve-static';
//import bodyParser from 'body-parser';
import * as WebSocket from 'ws';
import { createServer } from 'https';
import fs from 'fs';

var app = express();

var __dirname = path.resolve();

// Yes, TLS is required
const serverConfig = {
    key: fs.readFileSync(resolve(__dirname, 'certifications/privkey.pem')),
    cert: fs.readFileSync(resolve(__dirname, 'certifications/fullchain.pem'))
};

app.use(serveStatic(__dirname + "/dist"));
//app.use(bodyParser.json());

const server = createServer(serverConfig, app);

const wss = new WebSocket.WebSocketServer({ server });

console.log('Websocket server started');

//make map client uid
var clients = new Map();

wss.on('connection', function (ws) {
    console.log('Client connected');


    for (var [key, value] of clients) {
        wss.broadcast(key);
    }

    ws.on('message', function (message) {
        //console.log('received: %s', message);
        var data = JSON.parse(message);

        if (data['offer_removed']) {
            console.log('Offer removed from ' + data['uuid']);
            for (var [key, value] of clients) {
                if (value == ws) {
                    clients.delete(key);
                    wss.broadcast(message);
                    break;
                }
            }
        }

        if (data['sdp']) {
            if (data['sdp']['type'] == 'offer') {
                console.log('Received offer from ' + data['uuid']);
                clients.set(message, ws);
                wss.broadcast(message);
            }
            else if (data['sdp']['type'] == 'answer') {
                console.log('Received answer from ' + data['uuid']);
                clients.set(message, ws);
                for (var [key, value] of clients) {
                    var data2 = JSON.parse(key);
                    if (data2['uuid'] == data['aimed_uuid']) {
                        value.send(message.toString());
                        //clients.delete(key);
                        break;
                    }
                }
            }
        }
        else if (data['ice']) {
            console.log('Received ICE from ' + data['uuid'] + ' to ' + data['aimed_uuid']);
            for (var [key, value] of clients) {
                var data2 = JSON.parse(key);
                if (data2['uuid'] == data['aimed_uuid']) {
                    console.log('Send ICE to ' + data['aimed_uuid']);
                    value.send(message.toString());
                    break;
                }
            }
        }
    });

    ws.on('close', function () {
        console.log('Client disconnected');
        for (var [key, value] of clients) {
            if (value == ws) {
                clients.delete(key);
                var msg = JSON.stringify({'uuid': JSON.parse(key)['uuid'], 'offer_removed': true});
                wss.broadcast(msg);
                break;
            }
        }
    });
});

wss.broadcast = function (data) {
    this.clients.forEach(function (client) {
        if (client.readyState === 1) {
            client.send(data.toString());
        }
    });
};

server.listen(process.env.PORT || 3000, () => {
    console.log(`Server running at https://127.0.0.1:${server.address().port}/`);
});