const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, '/')));

let players = {};

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        players[socket.id] = {
            id: socket.id,
            name: name,
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            mass: 20,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`
        };
        socket.emit('init', socket.id);
    });

    socket.on('mouseMove', (m) => {
        if (players[socket.id]) {
            // Prosty ruch w stronę myszki
            let p = players[socket.id];
            p.x += (m.x - (1920/2)) * 0.01; // Uproszczone dla testu
            p.y += (m.y - (1080/2)) * 0.01;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Aktualizacja pozycji 60 razy na sekundę
setInterval(() => {
    io.emit('update', players);
}, 16);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});