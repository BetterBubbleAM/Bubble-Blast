import { BinaryWriter } from '../serialization/BinaryWriter';
import { SERVER_OP } from '@shared/constants/NetworkOpcodes';
import { Body } from '@physics-engine/bodies/Body';

export class PacketEncoder {
    /**
     * Koduje pakiet 16: Aktualizacja wszystkich jednostek.
     * To jest "serce" komunikacji 1 do 1 z oryginałem.
     */
    public static encodeUpdateNodes(
        eatenIds: number[], 
        updatedNodes: Body[], 
        removedIds: number[]
    ): Uint8Array {
        const writer = new BinaryWriter(1024 * 32); // Duży bufor na start

        writer.writeUint8(SERVER_OP.UPDATE_NODES);

        // 1. Jednostki zjedzone (Eaten)
        writer.writeUint16(eatenIds.length);
        for (const id of eatenIds) {
            writer.writeUint32(id); // Kto zjadł (można rozszerzyć o ID ofiary)
            writer.writeUint32(id); // Kto został zjedzony
        }

        // 2. Jednostki aktualizowane (Ruch/Nowe)
        for (const node of updatedNodes) {
            writer.writeUint32(node.id);
            writer.writeInt32(Math.floor(node.position.x));
            writer.writeInt32(Math.floor(node.position.y));
            writer.writeUint16(Math.floor(node.radius));
            writer.writeUint8(0); // Flag: tutaj można słać info o skinach/kolorach
            
            // W oryginalnym protokole tu przesyła się nazwę tylko raz
            writer.writeString(""); 
        }
        writer.writeUint32(0); // Terminator listy aktualizacji

        // 3. Jednostki usunięte z pola widzenia (poza zasięgiem)
        writer.writeUint16(removedIds.length);
        for (const id of removedIds) {
            writer.writeUint32(id);
        }

        return writer.getBuffer();
    }
    /**
     * Informuje klienta, którą kulką steruje (Kod 32).
     */
    public static encodeOwnEntity(id: number): Uint8Array {
        const writer = new BinaryWriter(5);
        writer.writeUint8(SERVER_OP.OWN_ENTITY);
        writer.writeUint32(id);
        return writer.getBuffer();
    }

    /**
     * Przesyła nowe wymiary mapy (Kod 64).
     */
    public static encodeMapSize(minX: number, minY: number, maxX: number, maxY: number): Uint8Array {
        const writer = new BinaryWriter(33);
        writer.writeUint8(SERVER_OP.MAP_RESIZE);
        writer.writeFloat32(minX);
        writer.writeFloat32(minY);
        writer.writeFloat32(maxX);
        writer.writeFloat32(maxY);
        return writer.getBuffer();
    }
}