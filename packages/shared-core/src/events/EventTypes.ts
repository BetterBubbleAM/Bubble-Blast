/**
 * @file EventTypes.ts
 * @description Typy zdarzeń używane w całym systemie
 */

import { EntityId, PlayerId, Vector2 } from '../types/EntityTypes';

/**
 * Podstawowy interfejs zdarzenia
 */
export interface BaseEvent {
    type: string;
    timestamp: number;
    source?: string;
}

/**
 * Zdarzenia systemowe
 */
export namespace SystemEvents {
    export interface Started extends BaseEvent {
        type: 'system:started';
        version: string;
        environment: string;
    }

    export interface Stopped extends BaseEvent {
        type: 'system:stopped';
        reason: string;
    }

    export interface Error extends BaseEvent {
        type: 'system:error';
        error: Error;
        fatal: boolean;
    }

    export interface ConfigChanged extends BaseEvent {
        type: 'system:config:changed';
        key: string;
        oldValue: any;
        newValue: any;
    }

    export interface Tick extends BaseEvent {
        type: 'system:tick';
        deltaTime: number;
        elapsedTime: number;
        tick: number;
    }
}

/**
 * Zdarzenia sieciowe
 */
export namespace NetworkEvents {
    export interface Connected extends BaseEvent {
        type: 'network:connected';
        serverId: string;
        latency: number;
    }

    export interface Disconnected extends BaseEvent {
        type: 'network:disconnected';
        reason: string;
        code?: number;
    }

    export interface Reconnecting extends BaseEvent {
        type: 'network:reconnecting';
        attempt: number;
        maxAttempts: number;
    }

    export interface PacketSent extends BaseEvent {
        type: 'network:packet:sent';
        packetType: string;
        size: number;
        compressed: boolean;
    }

    export interface PacketReceived extends BaseEvent {
        type: 'network:packet:received';
        packetType: string;
        size: number;
        compressed: boolean;
    }

    export interface LatencyUpdated extends BaseEvent {
        type: 'network:latency:updated';
        latency: number;
        jitter: number;
    }

    export interface SnapshotReceived extends BaseEvent {
        type: 'network:snapshot:received';
        sequence: number;
        entities: number;
        size: number;
    }
}

/**
 * Zdarzenia gry
 */
export namespace GameEvents {
    export interface PlayerJoined extends BaseEvent {
        type: 'game:player:joined';
        playerId: PlayerId;
        playerName: string;
        teamId?: string;
    }

    export interface PlayerLeft extends BaseEvent {
        type: 'game:player:left';
        playerId: PlayerId;
        reason: 'disconnect' | 'timeout' | 'kicked';
    }

    export interface PlayerSpawned extends BaseEvent {
        type: 'game:player:spawned';
        playerId: PlayerId;
        entityId: EntityId;
        position: Vector2;
        mass: number;
    }

    export interface PlayerDied extends BaseEvent {
        type: 'game:player:died';
        playerId: PlayerId;
        killedBy?: PlayerId;
        position: Vector2;
        mass: number;
    }

    export interface PlayerRespawned extends BaseEvent {
        type: 'game:player:respawned';
        playerId: PlayerId;
        position: Vector2;
        mass: number;
    }

    export interface PlayerSplit extends BaseEvent {
        type: 'game:player:split';
        playerId: PlayerId;
        sourceCellId: EntityId;
        newCellId: EntityId;
        direction: Vector2;
        mass: number;
    }

    export interface PlayerMerged extends BaseEvent {
        type: 'game:player:merged';
        playerId: PlayerId;
        cells: EntityId[];
        resultCellId: EntityId;
        mass: number;
    }

    export interface CellEaten extends BaseEvent {
        type: 'game:cell:eaten';
        predatorId: EntityId;
        preyId: EntityId;
        preyType: 'player' | 'pellet' | 'virus';
        massTransferred: number;
    }

    export interface VirusPopped extends BaseEvent {
        type: 'game:virus:popped';
        virusId: EntityId;
        position: Vector2;
        newViruses: EntityId[];
    }

    export interface ScoreUpdated extends BaseEvent {
        type: 'game:score:updated';
        playerId: PlayerId;
        oldScore: number;
        newScore: number;
        reason: 'kill' | 'pellet' | 'decay' | 'time';
    }

    export interface LeaderboardUpdated extends BaseEvent {
        type: 'game:leaderboard:updated';
        leaderboard: Array<{
            playerId: PlayerId;
            name: string;
            score: number;
            rank: number;
        }>;
    }
}

/**
 * Zdarzenia fizyki
 */
export namespace PhysicsEvents {
    export interface Collision extends BaseEvent {
        type: 'physics:collision';
        bodyA: EntityId;
        bodyB: EntityId;
        point: Vector2;
        normal: Vector2;
        impulse: number;
    }

    export interface BodyCreated extends BaseEvent {
        type: 'physics:body:created';
        entityId: EntityId;
        type: string;
        mass: number;
        radius: number;
    }

    export interface BodyDestroyed extends BaseEvent {
        type: 'physics:body:destroyed';
        entityId: EntityId;
        reason: 'eaten' | 'decay' | 'out_of_bounds';
    }

    export interface BodyMoved extends BaseEvent {
        type: 'physics:body:moved';
        entityId: EntityId;
        oldPosition: Vector2;
        newPosition: Vector2;
        velocity: Vector2;
    }

    export interface BoundaryHit extends BaseEvent {
        type: 'physics:boundary:hit';
        entityId: EntityId;
        boundary: 'left' | 'right' | 'top' | 'bottom';
        position: Vector2;
    }
}

/**
 * Zdarzenia ECS
 */
export namespace EcsEvents {
    export interface EntityCreated extends BaseEvent {
        type: 'ecs:entity:created';
        entityId: EntityId;
        archetype: string[];
    }

    export interface EntityDestroyed extends BaseEvent {
        type: 'ecs:entity:destroyed';
        entityId: EntityId;
    }

    export interface ComponentAdded extends BaseEvent {
        type: 'ecs:component:added';
        entityId: EntityId;
        componentType: string;
    }

    export interface ComponentRemoved extends BaseEvent {
        type: 'ecs:component:removed';
        entityId: EntityId;
        componentType: string;
    }

    export interface SystemExecuted extends BaseEvent {
        type: 'ecs:system:executed';
        systemName: string;
        entitiesProcessed: number;
        executionTime: number;
    }
}

/**
 * Zdarzenia UI
 */
export namespace UiEvents {
    export interface ButtonClicked extends BaseEvent {
        type: 'ui:button:clicked';
        buttonId: string;
        buttonText: string;
    }

    export interface MenuOpened extends BaseEvent {
        type: 'ui:menu:opened';
        menuName: string;
    }

    export interface MenuClosed extends BaseEvent {
        type: 'ui:menu:closed';
        menuName: string;
    }

    export interface SettingChanged extends BaseEvent {
        type: 'ui:setting:changed';
        settingKey: string;
        oldValue: any;
        newValue: any;
    }

    export interface HudElementToggled extends BaseEvent {
        type: 'ui:hud:toggled';
        elementId: string;
        visible: boolean;
    }
}

/**
 * Zdarzenia inputu
 */
export namespace InputEvents {
    export interface MouseMoved extends BaseEvent {
        type: 'input:mouse:moved';
        x: number;
        y: number;
        deltaX: number;
        deltaY: number;
    }

    export interface MouseClicked extends BaseEvent {
        type: 'input:mouse:clicked';
        button: 'left' | 'right' | 'middle';
        x: number;
        y: number;
    }

    export interface MousePressed extends BaseEvent {
        type: 'input:mouse:pressed';
        button: 'left' | 'right' | 'middle';
        x: number;
        y: number;
    }

    export interface MouseReleased extends BaseEvent {
        type: 'input:mouse:released';
        button: 'left' | 'right' | 'middle';
        x: number;
        y: number;
    }

    export interface KeyPressed extends BaseEvent {
        type: 'input:key:pressed';
        key: string;
        code: string;
        repeat: boolean;
    }

    export interface KeyReleased extends BaseEvent {
        type: 'input:key:released';
        key: string;
        code: string;
    }

    export interface TouchStarted extends BaseEvent {
        type: 'input:touch:started';
        touches: Array<{ id: number; x: number; y: number }>;
    }

    export interface TouchMoved extends BaseEvent {
        type: 'input:touch:moved';
        touches: Array<{ id: number; x: number; y: number }>;
    }

    export interface TouchEnded extends BaseEvent {
        type: 'input:touch:ended';
        touches: Array<{ id: number; x: number; y: number }>;
    }
}

/**
 * Zdarzenia renderowania
 */
export namespace RenderEvents {
    export interface FrameRendered extends BaseEvent {
        type: 'render:frame:rendered';
        frameTime: number;
        drawCalls: number;
        entitiesRendered: number;
    }

    export interface CameraMoved extends BaseEvent {
        type: 'render:camera:moved';
        x: number;
        y: number;
        zoom: number;
    }

    export interface ResolutionChanged extends BaseEvent {
        type: 'render:resolution:changed';
        width: number;
        height: number;
        aspectRatio: number;
    }

    export interface LayerVisibilityChanged extends BaseEvent {
        type: 'render:layer:visibility:changed';
        layerName: string;
        visible: boolean;
    }
}

/**
 * Zdarzenia audio
 */
export namespace AudioEvents {
    export interface SoundPlayed extends BaseEvent {
        type: 'audio:sound:played';
        soundId: string;
        volume: number;
        loop: boolean;
    }

    export interface SoundStopped extends BaseEvent {
        type: 'audio:sound:stopped';
        soundId: string;
    }

    export interface VolumeChanged extends BaseEvent {
        type: 'audio:volume:changed';
        channel: 'master' | 'music' | 'sfx';
        oldVolume: number;
        newVolume: number;
    }
}

/**
 * Zdarzenia wydajności
 */
export namespace PerformanceEvents {
    export interface FpsUpdated extends BaseEvent {
        type: 'performance:fps:updated';
        fps: number;
        min: number;
        max: number;
    }

    export interface MemoryUsage extends BaseEvent {
        type: 'performance:memory:usage';
        used: number;
        total: number;
        limit: number;
    }

    export interface CpuUsage extends BaseEvent {
        type: 'performance:cpu:usage';
        usage: number;
        cores: number;
    }

    export interface LagSpike extends BaseEvent {
        type: 'performance:lag:spike';
        duration: number;
        threshold: number;
    }
}

/**
 * Zdarzenia debug
 */
export namespace DebugEvents {
    export interface CommandExecuted extends BaseEvent {
        type: 'debug:command:executed';
        command: string;
        args: string[];
        result: any;
    }

    export interface OverlayToggled extends BaseEvent {
        type: 'debug:overlay:toggled';
        overlayName: string;
        visible: boolean;
    }

    export interface StatsUpdated extends BaseEvent {
        type: 'debug:stats:updated';
        stats: Record<string, number>;
    }
}

/**
 * Unia wszystkich zdarzeń
 */
export type GameEvent = 
    | SystemEvents.Started
    | SystemEvents.Stopped
    | SystemEvents.Error
    | SystemEvents.ConfigChanged
    | SystemEvents.Tick
    | NetworkEvents.Connected
    | NetworkEvents.Disconnected
    | NetworkEvents.Reconnecting
    | NetworkEvents.PacketSent
    | NetworkEvents.PacketReceived
    | NetworkEvents.LatencyUpdated
    | NetworkEvents.SnapshotReceived
    | GameEvents.PlayerJoined
    | GameEvents.PlayerLeft
    | GameEvents.PlayerSpawned
    | GameEvents.PlayerDied
    | GameEvents.PlayerRespawned
    | GameEvents.PlayerSplit
    | GameEvents.PlayerMerged
    | GameEvents.CellEaten
    | GameEvents.VirusPopped
    | GameEvents.ScoreUpdated
    | GameEvents.LeaderboardUpdated
    | PhysicsEvents.Collision
    | PhysicsEvents.BodyCreated
    | PhysicsEvents.BodyDestroyed
    | PhysicsEvents.BodyMoved
    | PhysicsEvents.BoundaryHit
    | EcsEvents.EntityCreated
    | EcsEvents.EntityDestroyed
    | EcsEvents.ComponentAdded
    | EcsEvents.ComponentRemoved
    | EcsEvents.SystemExecuted
    | UiEvents.ButtonClicked
    | UiEvents.MenuOpened
    | UiEvents.MenuClosed
    | UiEvents.SettingChanged
    | UiEvents.HudElementToggled
    | InputEvents.MouseMoved
    | InputEvents.MouseClicked
    | InputEvents.MousePressed
    | InputEvents.MouseReleased
    | InputEvents.KeyPressed
    | InputEvents.KeyReleased
    | InputEvents.TouchStarted
    | InputEvents.TouchMoved
    | InputEvents.TouchEnded
    | RenderEvents.FrameRendered
    | RenderEvents.CameraMoved
    | RenderEvents.ResolutionChanged
    | RenderEvents.LayerVisibilityChanged
    | AudioEvents.SoundPlayed
    | AudioEvents.SoundStopped
    | AudioEvents.VolumeChanged
    | PerformanceEvents.FpsUpdated
    | PerformanceEvents.MemoryUsage
    | PerformanceEvents.CpuUsage
    | PerformanceEvents.LagSpike
    | DebugEvents.CommandExecuted
    | DebugEvents.OverlayToggled
    | DebugEvents.StatsUpdated;

/**
 * Typy zdarzeń jako stringi
 */
export const EventTypes = {
    // System
    SYSTEM_STARTED: 'system:started',
    SYSTEM_STOPPED: 'system:stopped',
    SYSTEM_ERROR: 'system:error',
    SYSTEM_CONFIG_CHANGED: 'system:config:changed',
    SYSTEM_TICK: 'system:tick',

    // Network
    NETWORK_CONNECTED: 'network:connected',
    NETWORK_DISCONNECTED: 'network:disconnected',
    NETWORK_RECONNECTING: 'network:reconnecting',
    NETWORK_PACKET_SENT: 'network:packet:sent',
    NETWORK_PACKET_RECEIVED: 'network:packet:received',
    NETWORK_LATENCY_UPDATED: 'network:latency:updated',
    NETWORK_SNAPSHOT_RECEIVED: 'network:snapshot:received',

    // Game
    GAME_PLAYER_JOINED: 'game:player:joined',
    GAME_PLAYER_LEFT: 'game:player:left',
    GAME_PLAYER_SPAWNED: 'game:player:spawned',
    GAME_PLAYER_DIED: 'game:player:died',
    GAME_PLAYER_RESPAWNED: 'game:player:respawned',
    GAME_PLAYER_SPLIT: 'game:player:split',
    GAME_PLAYER_MERGED: 'game:player:merged',
    GAME_CELL_EATEN: 'game:cell:eaten',
    GAME_VIRUS_POPPED: 'game:virus:popped',
    GAME_SCORE_UPDATED: 'game:score:updated',
    GAME_LEADERBOARD_UPDATED: 'game:leaderboard:updated',

    // Physics
    PHYSICS_COLLISION: 'physics:collision',
    PHYSICS_BODY_CREATED: 'physics:body:created',
    PHYSICS_BODY_DESTROYED: 'physics:body:destroyed',
    PHYSICS_BODY_MOVED: 'physics:body:moved',
    PHYSICS_BOUNDARY_HIT: 'physics:boundary:hit',

    // ECS
    ECS_ENTITY_CREATED: 'ecs:entity:created',
    ECS_ENTITY_DESTROYED: 'ecs:entity:destroyed',
    ECS_COMPONENT_ADDED: 'ecs:component:added',
    ECS_COMPONENT_REMOVED: 'ecs:component:removed',
    ECS_SYSTEM_EXECUTED: 'ecs:system:executed',

    // UI
    UI_BUTTON_CLICKED: 'ui:button:clicked',
    UI_MENU_OPENED: 'ui:menu:opened',
    UI_MENU_CLOSED: 'ui:menu:closed',
    UI_SETTING_CHANGED: 'ui:setting:changed',
    UI_HUD_ELEMENT_TOGGLED: 'ui:hud:toggled',

    // Input
    INPUT_MOUSE_MOVED: 'input:mouse:moved',
    INPUT_MOUSE_CLICKED: 'input:mouse:clicked',
    INPUT_MOUSE_PRESSED: 'input:mouse:pressed',
    INPUT_MOUSE_RELEASED: 'input:mouse:released',
    INPUT_KEY_PRESSED: 'input:key:pressed',
    INPUT_KEY_RELEASED: 'input:key:released',
    INPUT_TOUCH_STARTED: 'input:touch:started',
    INPUT_TOUCH_MOVED: 'input:touch:moved',
    INPUT_TOUCH_ENDED: 'input:touch:ended',

    // Render
    RENDER_FRAME_RENDERED: 'render:frame:rendered',
    RENDER_CAMERA_MOVED: 'render:camera:moved',
    RENDER_RESOLUTION_CHANGED: 'render:resolution:changed',
    RENDER_LAYER_VISIBILITY_CHANGED: 'render:layer:visibility:changed',

    // Audio
    AUDIO_SOUND_PLAYED: 'audio:sound:played',
    AUDIO_SOUND_STOPPED: 'audio:sound:stopped',
    AUDIO_VOLUME_CHANGED: 'audio:volume:changed',

    // Performance
    PERFORMANCE_FPS_UPDATED: 'performance:fps:updated',
    PERFORMANCE_MEMORY_USAGE: 'performance:memory:usage',
    PERFORMANCE_CPU_USAGE: 'performance:cpu:usage',
    PERFORMANCE_LAG_SPIKE: 'performance:lag:spike',

    // Debug
    DEBUG_COMMAND_EXECUTED: 'debug:command:executed',
    DEBUG_OVERLAY_TOGGLED: 'debug:overlay:toggled',
    DEBUG_STATS_UPDATED: 'debug:stats:updated'
} as const;

/**
 * Typ dla EventTypes
 */
export type EventType = typeof EventTypes[keyof typeof EventTypes];