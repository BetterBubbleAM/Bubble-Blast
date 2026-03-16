import { GameRenderer } from '../rendering/GameRenderer';
import { StateManager } from '../core/StateManager';
import { SocketClient } from '../network/SocketClient';
import { PacketDispatcher } from '../network/PacketDispatcher';
import { InputManager } from '../input/InputManager';

// 1. Inicjalizacja rdzenia
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement || document.createElement('canvas');
if (!canvas.parentElement) document.body.appendChild(canvas);

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const state = new StateManager();
const renderer = new GameRenderer(canvas);
const dispatcher = new PacketDispatcher(state);
const socket = new SocketClient(dispatcher);
const input = new InputManager(canvas, socket);

// 2. Połączenie z serwerem
socket.connect('ws://localhost:3000');

// 3. Pętla renderowania
function frame() {
    // Pobieramy encje ze stanu i rysujemy
    renderer.render(state.getEntitiesArray());
    requestAnimationFrame(frame);
}

console.log("🚀 Bubble.am Client Started");
frame();