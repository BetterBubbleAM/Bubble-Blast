import { WebSocketServer } from 'ws';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const wss = new WebSocketServer({ port });

console.log(`--- BUBBLE-BLAST ENGINE ---`);
console.log(`[Status]: Serwer nasłuchuje na porcie: ${port}`);

wss.on('connection', (ws) => {
    console.log('[Network]: Nowy gracz połączony');
    
    // Prosty ping-pong dla testu połączenia
    ws.on('message', (data) => {
        console.log(`[Data]: Otrzymano ${data}`);
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    });

    ws.on('close', () => console.log('[Network]: Gracz rozłączony'));
});

// Zapobieganie usypianiu procesu na Renderze
setInterval(() => {
    console.log(`[Heartbeat]: Serwer żyje. Połączonych: ${wss.clients.size}`);
}, 30000);