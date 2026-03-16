import { BinaryReader } from '../../../../packages/network-protocol/src/encoding/BinaryReader';
import { SERVER_OP } from '../../../../packages/shared-core/src/constants/NetworkOpcodes';
import { StateManager } from '../core/StateManager';

export class PacketDispatcher {
    private state: StateManager;

    constructor(state: StateManager) {
        this.state = state;
    }

    public dispatch(buffer: ArrayBuffer) {
        const reader = new BinaryReader(buffer);
        const opcode = reader.readUint8();

        switch (opcode) {
            case SERVER_OP.UPDATE_NODES:
                this.handleUpdateNodes(reader);
                break;
            // Tutaj dojdą kolejne case'y (Own Entity, Map Resize itd.)
        }
    }

    private handleUpdateNodes(reader: BinaryReader) {
        // 1. Czytamy zjedzone kulki
        const eatenCount = reader.readUint16();
        for (let i = 0; i < eatenCount; i++) {
            const killerId = reader.readUint32();
            const victimId = reader.readUint32();
            this.state.removeEntity(victimId);
        }

        // 2. Czytamy aktualizacje pozycji
        while (true) {
            const id = reader.readUint32();
            if (id === 0) break; // Terminator z PacketEncoder

            const x = reader.readInt32();
            const y = reader.readInt32();
            const radius = reader.readUint16();
            
            // Przeskakujemy flagi i stringi na razie (zgodnie z PacketEncoder)
            reader.readUint8(); 
            reader.readString();

            this.state.updateEntity(id, x, y, radius);
        }

        // 3. Czytamy usunięte (poza zasięgiem wzroku)
        const removedCount = reader.readUint16();
        for (let i = 0; i < removedCount; i++) {
            this.state.removeEntity(reader.readUint32());
        }
    }
}