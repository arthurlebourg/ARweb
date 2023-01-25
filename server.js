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

server.listen(process.env.PORT || 3000, () => {
    console.log(`Server running at http://127.0.0.1:${server.address().port}/`);
});


/*var server = createServer(app);
var port = process.env.PORT || 3000;
server.listen(port);
server.on('listening', onListening);
server.on('error', onError);
const io = new Server(server);

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    console.log('Listening on ' + bind);
}

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }
    var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

var objects = [];

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('ready', () => {
        console.log('new player is ready');
        for (let i = 0; i < objects.length; i++) {
            io.emit('list object', objects[i]);
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
    
    socket.on('phone video', data => {
        //console.log(data);
        io.emit('computer video', data);

    });
});*/