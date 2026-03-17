/**
 * @file Serializer.ts
 * @description Serializacja pakietów do formatu binarnego
 */

import { BitBuffer, Endianness } from '@shared-core/utils/BitBuffer';
import { ClientPacketData, ClientPacketType } from '../schemas/ClientPackets';
import { ServerPacketData, ServerPacketType } from '../schemas/ServerPackets';
import { SnapshotEntity, DeltaEntityUpdate } from '../schemas/SnapshotPackets';
import { Vector2 } from '@shared-core/math/Vector2';

/**
 * Serializer pakietów
 */
export class PacketSerializer {
    private buffer: BitBuffer;
    private useCompression: boolean = false;

    constructor(initialSize: number = 4096, useCompression: boolean = false) {
        this.buffer = new BitBuffer(initialSize, Endianness.LITTLE_ENDIAN);
        this.useCompression = useCompression;
    }

    /**
     * Serializuje pakiet klienta
     */
    serializeClientPacket(packet: ClientPacketData): Uint8Array {
        this.buffer.reset();
        
        // Nagłówek
        this.buffer.writeByte(packet.type);
        this.buffer.writeUint32(packet.timestamp);
        this.buffer.writeUint16(packet.sequence);

        // Serializuj w zależności od typu
        switch (packet.type) {
            case ClientPacketType.HANDSHAKE:
                this.serializeHandshake(packet);
                break;
            case ClientPacketType.PING:
                this.serializePing(packet);
                break;
            case ClientPacketType.INPUT_STATE:
                this.serializeInputState(packet);
                break;
            case ClientPacketType.MOUSE_MOVE:
                this.serializeMouseMove(packet);
                break;
            case ClientPacketType.SPLIT:
                this.serializeSplit(packet);
                break;
            case ClientPacketType.CHAT_MESSAGE:
                this.serializeChatMessage(packet);
                break;
        }

        return this.buffer.data;
    }

    /**
     * Serializuje pakiet serwera
     */
    serializeServerPacket(packet: ServerPacketData): Uint8Array {
        this.buffer.reset();
        
        // Nagłówek
        this.buffer.writeByte(packet.type);
        this.buffer.writeUint32(packet.timestamp);
        this.buffer.writeUint16(packet.sequence);
        this.buffer.writeUint32(packet.serverTime);

        // Serializuj w zależności od typu
        switch (packet.type) {
            case ServerPacketType.HANDSHAKE_ACCEPT:
                this.serializeHandshakeAccept(packet);
                break;
            case ServerPacketType.WORLD_SNAPSHOT:
                this.serializeWorldSnapshot(packet);
                break;
            case ServerPacketType.LEADERBOARD_UPDATE:
                this.serializeLeaderboard(packet);
                break;
        }

        return this.buffer.data;
    }

    /**
     * Serializuje handshake
     */
    private serializeHandshake(packet: any): void {
        this.buffer.writeString(packet.version);
        this.buffer.writeString(packet.playerName);
        this.buffer.writeByte(packet.skinId ? 1 : 0);
        if (packet.skinId) {
            this.buffer.writeString(packet.skinId);
        }
        this.buffer.writeByte(this.getDeviceCode(packet.device));
        this.buffer.writeUint16(packet.screenWidth);
        this.buffer.writeUint16(packet.screenHeight);
        this.buffer.writeString(packet.language);
    }

    /**
     * Serializuje ping
     */
    private serializePing(packet: any): void {
        this.buffer.writeUint32(packet.clientTime);
    }

    /**
     * Serializuje stan inputu
     */
    private serializeInputState(packet: any): void {
        this.serializeVector2(packet.targetPosition);
        
        // Flagi akcji (bitfield)
        let flags = 0;
        if (packet.isSplitting) flags |= 1;
        if (packet.isEjecting) flags |= 2;
        if (packet.isMerging) flags |= 4;
        this.buffer.writeByte(flags);

        if (packet.movementDirection) {
            this.buffer.writeByte(1);
            this.serializeVector2(packet.movementDirection);
        } else {
            this.buffer.writeByte(0);
        }
    }

    /**
     * Serializuje ruch myszy
     */
    private serializeMouseMove(packet: any): void {
        this.buffer.writeUint16(packet.x);
        this.buffer.writeUint16(packet.y);
        this.buffer.writeUint32(packet.worldX);
        this.buffer.writeUint32(packet.worldY);
    }

    /**
     * Serializuje split
     */
    private serializeSplit(packet: any): void {
        this.serializeVector2(packet.direction);
        if (packet.cellId) {
            this.buffer.writeByte(1);
            this.buffer.writeUint32(packet.cellId);
        } else {
            this.buffer.writeByte(0);
        }
    }

    /**
     * Serializuje wiadomość czatu
     */
    private serializeChatMessage(packet: any): void {
        this.buffer.writeString(packet.message);
        this.buffer.writeByte(this.getChatTargetCode(packet.target));
        if (packet.targetId) {
            this.buffer.writeString(packet.targetId);
        }
    }

    /**
     * Serializuje handshake accept
     */
    private serializeHandshakeAccept(packet: any): void {
        this.buffer.writeString(packet.playerId);
        this.buffer.writeString(packet.serverVersion);
        this.buffer.writeUint32(packet.worldWidth);
        this.buffer.writeUint32(packet.worldHeight);
        this.buffer.writeByte(packet.serverTickRate);
        this.buffer.writeByte(packet.snapshotRate);
        this.buffer.writeByte(packet.compression ? 1 : 0);
    }

    /**
     * Serializuje snapshot świata
     */
    private serializeWorldSnapshot(packet: any): void {
        this.buffer.writeUint32(packet.frame);
        this.buffer.writeUint32(packet.timestamp);
        this.buffer.writeByte(packet.delta ? 1 : 0);
        
        if (packet.delta) {
            this.buffer.writeUint16(packet.baseSequence);
            this.serializeDeltaSnapshot(packet);
        } else {
            this.serializeFullSnapshot(packet);
        }
    }

    /**
     * Serializuje pełny snapshot
     */
    private serializeFullSnapshot(packet: any): void {
        const entities = packet.entities;
        this.buffer.writeUint16(entities.length);

        for (const entity of entities) {
            this.serializeSnapshotEntity(entity);
        }

        this.buffer.writeUint16(packet.playerEntities.length);
        for (const id of packet.playerEntities) {
            this.buffer.writeUint32(id);
        }
    }

    /**
     * Serializuje snapshot różnicowy
     */
    private serializeDeltaSnapshot(packet: any): void {
        // Dodane encje
        this.buffer.writeUint16(packet.added?.length || 0);
        for (const entity of packet.added || []) {
            this.serializeSnapshotEntity(entity);
        }

        // Usunięte encje
        this.buffer.writeUint16(packet.removed?.length || 0);
        for (const id of packet.removed || []) {
            this.buffer.writeUint32(id);
        }

        // Zaktualizowane encje
        this.buffer.writeUint16(packet.updated?.length || 0);
        for (const update of packet.updated || []) {
            this.serializeDeltaUpdate(update);
        }
    }

    /**
     * Serializuje pojedynczą encję snapshotu
     */
    private serializeSnapshotEntity(entity: SnapshotEntity): void {
        this.buffer.writeUint32(entity.id);
        this.buffer.writeByte(this.getEntityTypeCode(entity.type));
        this.serializeVector2(entity.position);
        this.buffer.writeUint16(entity.radius);
        this.buffer.writeUint16(entity.mass);
        this.buffer.writeString(entity.color);
        this.buffer.writeUint32(entity.flags);

        // Opcjonalne pola
        if (entity.playerId) {
            this.buffer.writeByte(1);
            this.buffer.writeString(entity.playerId);
            this.buffer.writeString(entity.playerName || '');
        } else {
            this.buffer.writeByte(0);
        }

        if (entity.velocity) {
            this.buffer.writeByte(1);
            this.serializeVector2(entity.velocity);
        } else {
            this.buffer.writeByte(0);
        }
    }

    /**
     * Serializuje różnicową aktualizację
     */
    private serializeDeltaUpdate(update: DeltaEntityUpdate): void {
        this.buffer.writeUint32(update.id);
        this.buffer.writeUint16(update.changedMask);

        if (update.changedMask & 1 && update.position) {
            this.serializeVector2(update.position);
        }
        if (update.changedMask & 2 && update.radius) {
            this.buffer.writeUint16(update.radius);
        }
        if (update.changedMask & 4 && update.mass) {
            this.buffer.writeUint16(update.mass);
        }
        if (update.changedMask & 8 && update.color) {
            this.buffer.writeString(update.color);
        }
        if (update.changedMask & 16 && update.velocity) {
            this.serializeVector2(update.velocity);
        }
        if (update.changedMask & 32 && update.flags) {
            this.buffer.writeUint32(update.flags);
        }
    }

    /**
     * Serializuje leaderboard
     */
    private serializeLeaderboard(packet: any): void {
        this.buffer.writeUint16(packet.entries.length);
        this.buffer.writeUint16(packet.totalPlayers);

        for (const entry of packet.entries) {
            this.buffer.writeUint16(entry.rank);
            this.buffer.writeString(entry.playerId);
            this.buffer.writeString(entry.name);
            this.buffer.writeUint32(entry.score);
            this.buffer.writeString(entry.color);
        }
    }

    /**
     * Serializuje wektor 2D
     */
    private serializeVector2(vec: Vector2): void {
        this.buffer.writeFloat32(vec.x);
        this.buffer.writeFloat32(vec.y);
    }

    /**
     * Kod urządzenia
     */
    private getDeviceCode(device: string): number {
        const codes: Record<string, number> = {
            'web': 0,
            'mobile': 1,
            'desktop': 2
        };
        return codes[device] || 0;
    }

    /**
     * Kod celu czatu
     */
    private getChatTargetCode(target?: string): number {
        const codes: Record<string, number> = {
            'all': 0,
            'team': 1,
            'player': 2
        };
        return target ? codes[target] || 0 : 0;
    }

    /**
     * Kod typu encji
     */
    private getEntityTypeCode(type: string): number {
        const codes: Record<string, number> = {
            'player': 0,
            'cell': 1,
            'virus': 2,
            'pellet': 3
        };
        return codes[type] || 0;
    }

    /**
     * Resetuje serializer
     */
    reset(): void {
        this.buffer.reset();
    }
}