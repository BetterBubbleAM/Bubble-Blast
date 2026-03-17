/**
 * @file ClientPackets.ts
 * @description Pakiety wysyłane przez klienta do serwera
 */

import { Vector2 } from '@shared-core/math/Vector2';

/**
 * Typy pakietów klienta
 */
export enum ClientPacketType {
    // Połączenie
    HANDSHAKE = 0x01,
    PING = 0x02,
    DISCONNECT = 0x03,

    // Input
    INPUT_STATE = 0x10,
    MOUSE_MOVE = 0x11,
    TOUCH_START = 0x12,
    TOUCH_MOVE = 0x13,
    TOUCH_END = 0x14,

    // Akcje
    SPLIT = 0x20,
    MERGE = 0x21,
    EJECT = 0x22,

    // Chat
    CHAT_MESSAGE = 0x30,

    // Debug
    DEBUG_COMMAND = 0xF0
}

/**
 * Bazowa struktura pakietu klienta
 */
export interface ClientPacket {
    type: ClientPacketType;
    timestamp: number;
    sequence: number;
}

/**
 * Pakiet handshake - pierwszy pakiet połączenia
 */
export interface HandshakePacket extends ClientPacket {
    type: ClientPacketType.HANDSHAKE;
    version: string;           // Wersja klienta
    playerName: string;        // Nazwa gracza
    skinId?: string;           // ID skina
    device: 'web' | 'mobile' | 'desktop';
    screenWidth: number;
    screenHeight: number;
    language: string;
}

/**
 * Pakiet ping - do pomiaru latency
 */
export interface PingPacket extends ClientPacket {
    type: ClientPacketType.PING;
    clientTime: number;        // Czas wysłania po stronie klienta
}

/**
 * Pakiet rozłączenia
 */
export interface DisconnectPacket extends ClientPacket {
    type: ClientPacketType.DISCONNECT;
    reason: 'quit' | 'timeout' | 'error';
    message?: string;
}

/**
 * Stan inputu gracza
 */
export interface InputStatePacket extends ClientPacket {
    type: ClientPacketType.INPUT_STATE;
    targetPosition: Vector2;   // Pozycja celu (myszka/touch)
    isSplitting: boolean;      // Czy klawisz splitu wciśnięty
    isEjecting: boolean;       // Czy klawisz eject wciśnięty
    isMerging: boolean;        // Czy klawisz merge wciśnięty
    movementDirection?: Vector2; // Kierunek ruchu (dla klawiatury)
}

/**
 * Ruch myszy
 */
export interface MouseMovePacket extends ClientPacket {
    type: ClientPacketType.MOUSE_MOVE;
    x: number;
    y: number;
    worldX: number;
    worldY: number;
}

/**
 * Touch start
 */
export interface TouchStartPacket extends ClientPacket {
    type: ClientPacketType.TOUCH_START;
    touches: Array<{
        id: number;
        x: number;
        y: number;
        worldX: number;
        worldY: number;
    }>;
}

/**
 * Touch move
 */
export interface TouchMovePacket extends ClientPacket {
    type: ClientPacketType.TOUCH_MOVE;
    touches: Array<{
        id: number;
        x: number;
        y: number;
        worldX: number;
        worldY: number;
    }>;
}

/**
 * Touch end
 */
export interface TouchEndPacket extends ClientPacket {
    type: ClientPacketType.TOUCH_END;
    touchIds: number[];
}

/**
 * Akcja split - podzielenie komórki
 */
export interface SplitPacket extends ClientPacket {
    type: ClientPacketType.SPLIT;
    direction: Vector2;        // Kierunek podziału
    cellId?: number;           // ID komórki (jeśli wiele)
}

/**
 * Akcja merge - połączenie komórek
 */
export interface MergePacket extends ClientPacket {
    type: ClientPacketType.MERGE;
    sourceCellId: number;      // Źródłowa komórka
    targetCellId: number;      // Docelowa komórka
}

/**
 * Akcja eject - wyrzucenie masy
 */
export interface EjectPacket extends ClientPacket {
    type: ClientPacketType.EJECT;
    direction: Vector2;        // Kierunek wyrzutu
    cellId: number;            // ID komórki
}

/**
 * Wiadomość czatu
 */
export interface ChatMessagePacket extends ClientPacket {
    type: ClientPacketType.CHAT_MESSAGE;
    message: string;
    target?: 'all' | 'team' | 'player';
    targetId?: string;
}

/**
 * Komenda debug
 */
export interface DebugCommandPacket extends ClientPacket {
    type: ClientPacketType.DEBUG_COMMAND;
    command: string;
    args: string[];
}

/**
 * Unia wszystkich pakietów klienta
 */
export type ClientPacketData = 
    | HandshakePacket
    | PingPacket
    | DisconnectPacket
    | InputStatePacket
    | MouseMovePacket
    | TouchStartPacket
    | TouchMovePacket
    | TouchEndPacket
    | SplitPacket
    | MergePacket
    | EjectPacket
    | ChatMessagePacket
    | DebugCommandPacket;