/**
 * @file Deserializer.ts
 * @description Deserializacja pakietów z formatu binarnego
 */

import { BitReader } from '@shared-core/utils/BitBuffer';
import { ClientPacketData, ClientPacketType } from '../schemas/ClientPackets';
import { ServerPacketData, ServerPacketType } from '../schemas/ServerPackets';
import { SnapshotEntity, DeltaEntityUpdate } from '../schemas/SnapshotPackets';
import { Vector2 } from '@shared-core/math/Vector2';

/**
 * Deserializer pakietów
 */
export class PacketDeserializer {
    private reader: BitReader;

    constructor(data: Uint8Array) {
        this.reader = new BitReader(data);
    }

    /**
     * Deserializuje pakiet klienta
     */
    deserializeClientPacket(): ClientPacketData | null {
        try {
            const type = this.reader.readByte() as ClientPacketType;
            const timestamp = this.reader.readUint32();
            const sequence = this.reader.readUint16();

            switch (type) {
                case ClientPacketType.HANDSHAKE:
                    return this.deserializeHandshake(type, timestamp, sequence);
                case ClientPacketType.PING:
                    return this.deserializePing(type, timestamp, sequence);
                case ClientPacketType.INPUT_STATE:
                    return this.deserializeInputState(type, timestamp, sequence);
                case ClientPacketType.MOUSE_MOVE:
                    return this.deserializeMouseMove(type, timestamp, sequence);
                case ClientPacketType.SPLIT:
                    return this.deserializeSplit(type, timestamp, sequence);
                case ClientPacketType.CHAT_MESSAGE:
                    return this.deserializeChatMessage(type, timestamp, sequence);
                default:
                    console.warn(`Nieznany typ pakietu klienta: ${type}`);
                    return null;
            }
        } catch (e) {
            console.error('Błąd deserializacji pakietu klienta:', e);
            return null;
        }
    }

    /**
     * Deserializuje pakiet serwera
     */
    deserializeServerPacket(): ServerPacketData | null {
        try {
            const type = this.reader.readByte() as ServerPacketType;
            const timestamp = this.reader.readUint32();
            const sequence = this.reader.readUint16();
            const serverTime = this.reader.readUint32();

            switch (type) {
                case ServerPacketType.HANDSHAKE_ACCEPT:
                    return this.deserializeHandshakeAccept(type, timestamp, sequence, serverTime);
                case ServerPacketType.WORLD_SNAPSHOT:
                    return this.deserializeWorldSnapshot(type, timestamp, sequence, serverTime);
                case ServerPacketType.LEADERBOARD_UPDATE:
                    return this.deserializeLeaderboard(type, timestamp, sequence, serverTime);
                default:
                    console.warn(`Nieznany typ pakietu serwera: ${type}`);
                    return null;
            }
        } catch (e) {
            console.error('Błąd deserializacji pakietu serwera:', e);
            return null;
        }
    }

    /**
     * Deserializuje handshake
     */
    private deserializeHandshake(type: ClientPacketType, timestamp: number, sequence: number): ClientPacketData {
        const version = this.reader.readString();
        const playerName = this.reader.readString();
        const hasSkin = this.reader.readByte() === 1;
        const skinId = hasSkin ? this.reader.readString() : undefined;
        const deviceCode = this.reader.readByte();
        const screenWidth = this.reader.readUint16();
        const screenHeight = this.reader.readUint16();
        const language = this.reader.readString();

        return {
            type,
            timestamp,
            sequence,
            version,
            playerName,
            skinId,
            device: this.getDeviceFromCode(deviceCode),
            screenWidth,
            screenHeight,
            language
        };
    }

    /**
     * Deserializuje ping
     */
    private deserializePing(type: ClientPacketType, timestamp: number, sequence: number): ClientPacketData {
        const clientTime = this.reader.readUint32();
        return {
            type,
            timestamp,
            sequence,
            clientTime
        };
    }

    /**
     * Deserializuje stan inputu
     */
    private deserializeInputState(type: ClientPacketType, timestamp: number, sequence: number): ClientPacketData {
        const targetPosition = this.deserializeVector2();
        const flags = this.reader.readByte();
        const hasMovement = this.reader.readByte() === 1;
        const movementDirection = hasMovement ? this.deserializeVector2() : undefined;

        return {
            type,
            timestamp,
            sequence,
            targetPosition,
            isSplitting: (flags & 1) !== 0,
            isEjecting: (flags & 2) !== 0,
            isMerging: (flags & 4) !== 0,
            movementDirection
        };
    }

    /**
     * Deserializuje ruch myszy
     */
    private deserializeMouseMove(type: ClientPacketType, timestamp: number, sequence: number): ClientPacketData {
        const x = this.reader.readUint16();
        const y = this.reader.readUint16();
        const worldX = this.reader.readUint32();
        const worldY = this.reader.readUint32();

        return {
            type,
            timestamp,
            sequence,
            x,
            y,
            worldX,
            worldY
        };
    }

    /**
     * Deserializuje split
     */
    private deserializeSplit(type: ClientPacketType, timestamp: number, sequence: number): ClientPacketData {
        const direction = this.deserializeVector2();
        const hasCellId = this.reader.readByte() === 1;
        const cellId = hasCellId ? this.reader.readUint32() : undefined;

        return {
            type,
            timestamp,
            sequence,
            direction,
            cellId
        };
    }

    /**
     * Deserializuje wiadomość czatu
     */
    private deserializeChatMessage(type: ClientPacketType, timestamp: number, sequence: number): ClientPacketData {
        const message = this.reader.readString();
        const targetCode = this.reader.readByte();
        const hasTargetId = targetCode === 2;
        const targetId = hasTargetId ? this.reader.readString() : undefined;

        return {
            type,
            timestamp,
            sequence,
            message,
            target: this.getChatTargetFromCode(targetCode),
            targetId
        };
    }

    /**
     * Deserializuje handshake accept
     */
    private deserializeHandshakeAccept(type: ServerPacketType, timestamp: number, sequence: number, serverTime: number): ServerPacketData {
        const playerId = this.reader.readString();
        const serverVersion = this.reader.readString();
        const worldWidth = this.reader.readUint32();
        const worldHeight = this.reader.readUint32();
        const serverTickRate = this.reader.readByte();
        const snapshotRate = this.reader.readByte();
        const compression = this.reader.readByte() === 1;

        return {
            type,
            timestamp,
            sequence,
            serverTime,
            playerId,
            serverVersion,
            worldWidth,
            worldHeight,
            serverTickRate,
            snapshotRate,
            compression
        };
    }

    /**
     * Deserializuje snapshot świata
     */
    private deserializeWorldSnapshot(type: ServerPacketType, timestamp: number, sequence: number, serverTime: number): ServerPacketData {
        const frame = this.reader.readUint32();
        const snapshotTimestamp = this.reader.readUint32();
        const isDelta = this.reader.readByte() === 1;

        if (isDelta) {
            const baseSequence = this.reader.readUint16();
            const snapshot = this.deserializeDeltaSnapshot();
            return {
                type,
                timestamp,
                sequence,
                serverTime,
                frame,
                ...snapshot,
                delta: true,
                baseSequence
            };
        } else {
            const snapshot = this.deserializeFullSnapshot();
            return {
                type,
                timestamp,
                sequence,
                serverTime,
                frame,
                ...snapshot,
                delta: false
            };
        }
    }

    /**
     * Deserializuje pełny snapshot
     */
    private deserializeFullSnapshot(): any {
        const entityCount = this.reader.readUint16();
        const entities: SnapshotEntity[] = [];

        for (let i = 0; i < entityCount; i++) {
            entities.push(this.deserializeSnapshotEntity());
        }

        const playerEntityCount = this.reader.readUint16();
        const playerEntities: number[] = [];

        for (let i = 0; i < playerEntityCount; i++) {
            playerEntities.push(this.reader.readUint32());
        }

        return {
            entities,
            playerEntities,
            timestamp: 0 // Będzie ustawione później
        };
    }

    /**
     * Deserializuje snapshot różnicowy
     */
    private deserializeDeltaSnapshot(): any {
        // Dodane encje
        const addedCount = this.reader.readUint16();
        const added: SnapshotEntity[] = [];
        for (let i = 0; i < addedCount; i++) {
            added.push(this.deserializeSnapshotEntity());
        }

        // Usunięte encje
        const removedCount = this.reader.readUint16();
        const removed: number[] = [];
        for (let i = 0; i < removedCount; i++) {
            removed.push(this.reader.readUint32());
        }

        // Zaktualizowane encje
        const updatedCount = this.reader.readUint16();
        const updated: DeltaEntityUpdate[] = [];
        for (let i = 0; i < updatedCount; i++) {
            updated.push(this.deserializeDeltaUpdate());
        }

        return {
            added,
            removed,
            updated,
            timestamp: 0
        };
    }

    /**
     * Deserializuje pojedynczą encję snapshotu
     */
    private deserializeSnapshotEntity(): SnapshotEntity {
        const id = this.reader.readUint32();
        const typeCode = this.reader.readByte();
        const position = this.deserializeVector2();
        const radius = this.reader.readUint16();
        const mass = this.reader.readUint16();
        const color = this.reader.readString();
        const flags = this.reader.readUint32();

        const hasPlayerData = this.reader.readByte() === 1;
        let playerId, playerName;
        if (hasPlayerData) {
            playerId = this.reader.readString();
            playerName = this.reader.readString();
        }

        const hasVelocity = this.reader.readByte() === 1;
        const velocity = hasVelocity ? this.deserializeVector2() : undefined;

        return {
            id,
            type: this.getEntityTypeFromCode(typeCode),
            position,
            radius,
            mass,
            color,
            flags,
            playerId,
            playerName,
            velocity
        };
    }

    /**
     * Deserializuje różnicową aktualizację
     */
    private deserializeDeltaUpdate(): DeltaEntityUpdate {
        const id = this.reader.readUint32();
        const changedMask = this.reader.readUint16();

        const update: DeltaEntityUpdate = { id, changedMask };

        if (changedMask & 1) {
            update.position = this.deserializeVector2();
        }
        if (changedMask & 2) {
            update.radius = this.reader.readUint16();
        }
        if (changedMask & 4) {
            update.mass = this.reader.readUint16();
        }
        if (changedMask & 8) {
            update.color = this.reader.readString();
        }
        if (changedMask & 16) {
            update.velocity = this.deserializeVector2();
        }
        if (changedMask & 32) {
            update.flags = this.reader.readUint32();
        }

        return update;
    }

    /**
     * Deserializuje leaderboard
     */
    private deserializeLeaderboard(type: ServerPacketType, timestamp: number, sequence: number, serverTime: number): ServerPacketData {
        const entryCount = this.reader.readUint16();
        const totalPlayers = this.reader.readUint16();
        const entries = [];

        for (let i = 0; i < entryCount; i++) {
            entries.push({
                rank: this.reader.readUint16(),
                playerId: this.reader.readString(),
                name: this.reader.readString(),
                score: this.reader.readUint32(),
                color: this.reader.readString()
            });
        }

        return {
            type,
            timestamp,
            sequence,
            serverTime,
            entries,
            totalPlayers
        };
    }

    /**
     * Deserializuje wektor 2D
     */
    private deserializeVector2(): Vector2 {
        const x = this.reader.readFloat32();
        const y = this.reader.readFloat32();
        return new Vector2(x, y);
    }

    /**
     * Pobiera urządzenie z kodu
     */
    private getDeviceFromCode(code: number): 'web' | 'mobile' | 'desktop' {
        const devices: Array<'web' | 'mobile' | 'desktop'> = ['web', 'mobile', 'desktop'];
        return devices[code] || 'web';
    }

    /**
     * Pobiera typ encji z kodu
     */
    private getEntityTypeFromCode(code: number): 'player' | 'cell' | 'virus' | 'pellet' {
        const types: Array<'player' | 'cell' | 'virus' | 'pellet'> = ['player', 'cell', 'virus', 'pellet'];
        return types[code] || 'cell';
    }

    /**
     * Pobiera cel czatu z kodu
     */
    private getChatTargetFromCode(code: number): 'all' | 'team' | 'player' | undefined {
        const targets: Array<'all' | 'team' | 'player'> = ['all', 'team', 'player'];
        return targets[code];
    }
}