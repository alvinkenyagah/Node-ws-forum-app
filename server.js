// server.js
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const moment = require('moment');
const path = require('path');

class ChatServer {
    constructor() {
        this.app = express();
        this.setupExpress();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.clients = new Map();
        this.messages = [];
        this.messageLimit = 100;
        this.setupWebSocket();
    }

    setupExpress() {
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }

    getCurrentTime() {
        return moment().format('HH:mm:ss');
    }

    broadcastMessage(msg) {
        this.messages.push(msg);
        if (this.messages.length > this.messageLimit) {
            this.messages.shift();
        }

        this.clients.forEach((name, client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(msg), (err) => {
                    if (err) {
                        console.error('WebSocket error:', err);
                        this.handleClientDisconnect(client);
                    }
                });
            }
        });
    }

    broadcastUsers() {
        const userList = Array.from(this.clients.values());
        const msg = {
            type: 'users',
            users: userList,
        };

        this.clients.forEach((name, client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(msg), (err) => {
                    if (err) {
                        console.error('Error sending user list:', err);
                        this.handleClientDisconnect(client);
                    }
                });
            }
        });
    }

    handleClientDisconnect(client) {
        const name = this.clients.get(client);
        if (name) {
            this.clients.delete(client);
            this.broadcastUsers();
            this.broadcastMessage({
                type: 'message',
                name: 'System',
                content: `${name} has left the chat`,
                timestamp: this.getCurrentTime(),
                system: true,
            });
        }
        try {
            client.close();
        } catch (err) {
            console.error('Error closing client connection:', err);
        }
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('New client connected');
            
            // Send recent chat history
            this.messages.forEach((msg) => {
                ws.send(JSON.stringify(msg));
            });

            let name = '';

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data);
                    
                    switch (msg.type) {
                        case 'join':
                            name = msg.name.trim();
                            if (!name) return;
                            
                            this.clients.set(ws, name);
                            this.broadcastUsers();
                            this.broadcastMessage({
                                type: 'message',
                                name: 'System',
                                content: `${name} has joined the chat`,
                                timestamp: this.getCurrentTime(),
                                system: true,
                            });
                            break;

                        case 'message':
                            if (!name || !msg.content.trim()) return;
                            
                            this.broadcastMessage({
                                type: 'message',
                                name: name,
                                content: msg.content.trim(),
                                timestamp: this.getCurrentTime()
                            });
                            break;

                        default:
                            console.warn('Unknown message type:', msg.type);
                    }
                } catch (err) {
                    console.error('Error processing message:', err);
                }
            });

            ws.on('close', () => {
                console.log('Client disconnected');
                this.handleClientDisconnect(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.handleClientDisconnect(ws);
            });
        });
    }

    start(port = process.env.PORT || 8080) {
        this.server.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    }
}

// Start the server
const chatServer = new ChatServer();
chatServer.start();