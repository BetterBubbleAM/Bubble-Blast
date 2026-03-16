import { WebSocket } from 'ws';

export class SessionManager {
    private sessions: Map<string, WebSocket> = new Map();

    public addSession(id: string, socket: WebSocket) {
        this.sessions.set(id, socket);
    }

    public removeSession(id: string) {
        this.sessions.delete(id);
    }

    public broadcast(packet: Uint8Array) {
        this.sessions.forEach(socket => {
            if (socket.readyState === 1) { // 1 = OPEN
                socket.send(packet);
            }
        });
    }
}