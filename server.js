const WebSocket = require('ws');
const http = require('http');
const moment = require('moment');

// Stores connected clients and their names
const clients = new Map();

// Stores chat history
const messages = [];

// Get the current time in the desired format
function getCurrentTime() {
    return moment().format("HH:mm:ss");
}

// Broadcast message to all clients
function broadcastMessage(msg) {
    // Store message in chat history
    messages.push(msg);

    // Send message to all connected clients
    clients.forEach((name, client) => {
        client.send(JSON.stringify(msg), (err) => {
            if (err) {
                console.log('WebSocket error:', err);
                client.close();
                clients.delete(client);
            }
        });
    });
}

// Send online users list to all connected clients
function broadcastUsers() {
    const userList = Array.from(clients.values());

    clients.forEach((name, client) => {
        client.send(JSON.stringify({
            type: 'users',
            users: userList,
        }), (err) => {
            if (err) {
                console.log('Error sending user list:', err);
                client.close();
                clients.delete(client);
            }
        });
    });
}

// WebSocket connection handler
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    let name = '';

    // Send chat history to the new client
    messages.forEach((msg) => {
        ws.send(JSON.stringify(msg));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data);

        if (msg.type === 'join') {
            name = msg.name;

            // Store the client with their name
            clients.set(ws, name);

            // Notify others about the new user
            broadcastUsers();
            broadcastMessage({
                type: 'message',
                name: '',
                content: `${name} has joined the chat`,
                timestamp: getCurrentTime(),
                system: true,
            });
        } else if (msg.type === 'message') {
            msg.timestamp = getCurrentTime();

            // Store and broadcast the message
            broadcastMessage(msg);
        }
    });

    ws.on('close', () => {
        // Remove the client and broadcast updated users list
        if (name) {
            clients.delete(ws);
            broadcastUsers();

            // Notify others about the user leaving
            broadcastMessage({
                type: 'message',
                name: 'System',
                content: `${name} has left the chat`,
                timestamp: getCurrentTime(),
                system: true,
            });
        }
    });
});

// HTTP server to handle WebSocket upgrade
const server = http.createServer((req, res) => {
    res.writeHead(404);
    res.end();
});

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Start the server
server.listen(8080, () => {
    console.log('Server started on :8080');
});
