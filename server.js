import express from 'express';
import path, { resolve } from 'path';
import serveStatic from 'serve-static';
import * as WebSocket from 'ws';
import { createServer } from 'https';
import fs from 'fs';

const app = express();

const __dirname = path.resolve();

// config TLS for https
const TLSconfig = {
    key: fs.readFileSync(resolve(__dirname, 'certs', 'privkey.pem')),
    cert: fs.readFileSync(resolve(__dirname, 'certs', 'cert.cer'))
};

app.use(serveStatic(__dirname + "/dist"));

const server = createServer(TLSconfig, app);

const wss = new WebSocket.WebSocketServer({ server });

const clients = new Map();

wss.on('connection', function (ws) {
    console.log('client connected');

    for (const [key, value] of clients) {
        const data = JSON.parse(key);
        if (data['sdp']['type'] == 'offer') {
            ws.send(key.toString());
        }
    }

    ws.on('open', function () {
        console.log("socket opened");
    });

    ws.on('close', function () {
        console.log('client disconnected');
        for (const [key, value] of clients) {
            if (value == ws) {
                clients.delete(key);
                const msg = JSON.stringify({ 'uuid': JSON.parse(key)['uuid'], 'offer_removed': true });
                console.log('Offer removed from ' + JSON.parse(key)['uuid'] + ' by disconnection');
                wss.broadcast(msg);
                break;
            }
        }
    });

    ws.on('message', function (message) {
        const data = JSON.parse(message);

        if (data && data['offer_removed']) {
            console.log('Offer removed from ' + data['uuid']);
            for (const [key, value] of clients) {
                if (value == ws) {
                    clients.delete(key);
                    wss.broadcast(message);
                    console.log('Offer removed from ' + JSON.parse(key)['uuid'] + ' by offer_removed');
                    break;
                }
            }
        }
        else if (data && data['sdp']) {
            if (data['sdp']['type'] == 'offer') {
                console.log('Received offer from ' + data['uuid']);
                clients.set(message, ws);
                wss.broadcast(message);
            }
            else if (data['sdp']['type'] == 'answer') {
                console.log('Received answer from ' + data['uuid']);
                clients.set(message, ws);
                for (const [key, value] of clients) {
                    const data2 = JSON.parse(key);
                    if (data2['uuid'] == data['target_uuid']) {
                        value.send(message.toString());
                        //clients.delete(key);
                        break;
                    }
                }
            }
        }
        else if (data && data['ice']) {
            for (const [key, value] of clients) {
                const data2 = JSON.parse(key);
                if (data2['uuid'] == data['target_uuid']) {
                    console.log('Send ICE to ' + data['target_uuid']);
                    value.send(message.toString());
                    break;
                }
            }
        }
        else if (data && data['log']) {
            console.log(data['log'])
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
