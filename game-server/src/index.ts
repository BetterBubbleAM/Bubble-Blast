import { Server } from './bootstrap/Server';

const port = 3000;
const gameServer = new Server(port);

gameServer.init();

console.log(`\n--- BUBBLE.AM ENGINE ---`);
console.log(`[Status]: Serwer działa na porcie ${port}`);
console.log(`[Info]: Czekam na połączenia graczy...\n`);