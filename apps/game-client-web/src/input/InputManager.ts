import { Vector2 } from '../../../../packages/shared-core/src/math/Vector2';
import { SocketClient } from '../network/SocketClient';

export class InputManager {
    public mousePosition: Vector2 = new Vector2(0, 0);
    private socket: SocketClient;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement, socket: SocketClient) {
        this.canvas = canvas;
        this.socket = socket;
        this.initEvents();
    }

    private initEvents() {
        // Ruch myszki
        window.addEventListener('mousemove', (e) => {
            // Obliczamy pozycję względem środka ekranu (centrum kamery)
            this.mousePosition.x = e.clientX - window.innerWidth / 2;
            this.mousePosition.y = e.clientY - window.innerHeight / 2;
            
            // Wysyłamy aktualizację do serwera
            this.socket.sendMove(this.mousePosition.x, this.mousePosition.y);
        });

        // Klawisze
        window.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'Space':
                    this.socket.sendSplit();
                    break;
                case 'KeyW':
                    this.socket.sendEject();
                    break;
                case 'KeyQ':
                    this.socket.sendQStop();
                    break;
            }
        });
    }
}