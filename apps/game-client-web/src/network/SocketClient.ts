import { BinaryWriter } from '../../../../packages/network-protocol/src/encoding/BinaryWriter';
import { CLIENT_OP } from '../../../../packages/shared-core/src/constants/NetworkOpcodes';
import { PacketDispatcher } from './PacketDispatcher';

export class SocketClient {
    private socket: WebSocket | null = null;
    private dispatcher: PacketDispatcher;

    constructor(dispatcher: PacketDispatcher) {
        this.dispatcher = dispatcher;
    }

    public connect(url: string) {
        this.socket = new WebSocket(url);
        this.socket.binaryType = 'arraybuffer';
        this.socket.onmessage = (e) => e.data instanceof ArrayBuffer && this.dispatcher.dispatch(e.data);
    }

    private send(buffer: ArrayBuffer) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(buffer);
        }
    }

    public sendMove(x: number, y: number) {
        const writer = new BinaryWriter(9);
        writer.writeUint8(CLIENT_OP.MOUSE_MOVE);
        writer.writeFloat32(x);
        writer.writeFloat32(y);
        this.send(writer.getBuffer());
    }

    public sendSplit() {
        const writer = new BinaryWriter(1);
        writer.writeUint8(CLIENT_OP.SPLIT);
        this.send(writer.getBuffer());
    }

    public sendEject() {
        const writer = new BinaryWriter(1);
        writer.writeUint8(CLIENT_OP.EJECT);
        this.send(writer.getBuffer());
    }

    public sendQStop() {
        const writer = new BinaryWriter(1);
        writer.writeUint8(CLIENT_OP.Q_STOP);
        this.send(writer.getBuffer());
    }
}