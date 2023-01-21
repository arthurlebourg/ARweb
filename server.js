// server.js
import fs from 'fs';
import express from 'express';
import path, { resolve } from 'path';
import serveStatic from 'serve-static';
import { createServer } from 'http';
import { Server } from 'socket.io';
import bodyParser from 'body-parser';

var app = express();

var __dirname = path.resolve();

app.use(serveStatic(__dirname + "/dist"));
app.use(bodyParser.json());
var port = process.env.PORT || 5000;
var hostname = '127.0.0.1';

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

var server = createServer(app);
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
    

    socket.on('add object', (data) => {
        console.log(data);
        objects.push(data);
        io.emit('list object', data);
    });

    socket.on('phone video', data => {
        //console.log(data);
        io.emit('computer video', data);

    });
});