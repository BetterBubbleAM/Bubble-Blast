/**
 * @file preloadAssets.ts
 * @description Wstępne ładowanie assetów przed startem gry
 */

import { AssetManager } from '../assets/AssetManager';
import { AssetType } from '@asset-system/AssetRegistry';

/**
 | Lista assetów do preloadowania
 */
const PRELOAD_ASSETS = [
    // Tekstury komórek
    { id: 'cell_default', type: AssetType.TEXTURE, path: '/assets/cell/default.png' },
    { id: 'cell_player', type: AssetType.TEXTURE, path: '/assets/cell/player.png' },
    { id: 'cell_enemy', type: AssetType.TEXTURE, path: '/assets/cell/enemy.png' },
    { id: 'cell_bot', type: AssetType.TEXTURE, path: '/assets/cell/bot.png' },
    
    // Tekstury wirusów
    { id: 'virus_default', type: AssetType.TEXTURE, path: '/assets/virus/default.png' },
    { id: 'virus_poison', type: AssetType.TEXTURE, path: '/assets/virus/poison.png' },
    
    // Tekstury pelletów
    { id: 'pellet_default', type: AssetType.TEXTURE, path: '/assets/pellet/default.png' },
    
    // Tekstury UI
    { id: 'ui_button', type: AssetType.TEXTURE, path: '/assets/ui/button.png' },
    { id: 'ui_panel', type: AssetType.TEXTURE, path: '/assets/ui/panel.png' },
    { id: 'ui_joystick', type: AssetType.TEXTURE, path: '/assets/ui/joystick.png' },
    
    // Efekty
    { id: 'effect_split', type: AssetType.TEXTURE, path: '/assets/effects/split.png' },
    { id: 'effect_eat', type: AssetType.TEXTURE, path: '/assets/effects/eat.png' },
    { id: 'effect_death', type: AssetType.TEXTURE, path: '/assets/effects/death.png' },
    
    // Dźwięki
    { id: 'sound_split', type: AssetType.AUDIO, path: '/assets/sounds/split.mp3' },
    { id: 'sound_eat', type: AssetType.AUDIO, path: '/assets/sounds/eat.mp3' },
    { id: 'sound_merge', type: AssetType.AUDIO, path: '/assets/sounds/merge.mp3' },
    { id: 'sound_death', type: AssetType.AUDIO, path: '/assets/sounds/death.mp3' },
    { id: 'sound_spawn', type: AssetType.AUDIO, path: '/assets/sounds/spawn.mp3' },
    
    // Czcionki
    { id: 'font_main', type: AssetType.FONT, path: '/assets/fonts/main.woff2' },
    
    // Konfiguracje
    { id: 'config_particles', type: AssetType.JSON, path: '/assets/configs/particles.json' },
    { id: 'config_colors', type: AssetType.JSON, path: '/assets/configs/colors.json' }
];

/**
 | Wykonuje preload assetów
 */
export async function preloadAssets(assetManager: AssetManager): Promise<void> {
    const startTime = performance.now();

    try {
        // Rejestruj assety
        for (const asset of PRELOAD_ASSETS) {
            assetManager.registerAsset(asset);
        }

        // Ładuj assety z priorytetem
        const highPriority = PRELOAD_ASSETS.filter(a => 
            a.id.startsWith('cell_') || 
            a.id.startsWith('ui_') || 
            a.id === 'font_main'
        );

        const lowPriority = PRELOAD_ASSETS.filter(a => 
            !highPriority.includes(a)
        );

        // Najpierw ładuj wysokiego priorytetu
        await assetManager.loadMany(highPriority, {
            priority: 100,
            timeout: 5000,
            retries: 2
        });

        // Potem resztę w tle
        assetManager.loadMany(lowPriority, {
            priority: 50,
            timeout: 10000,
            retries: 1
        }).catch(error => {
            console.warn('Failed to load some low priority assets:', error);
        });

        const duration = performance.now() - startTime;
        console.log(`Preloaded ${PRELOAD_ASSETS.length} assets in ${duration.toFixed(2)}ms`);

    } catch (error) {
        console.error('Failed to preload assets:', error);
        throw error;
    }
}

/**
 | Tworzy fake asset manager do testów
 */
export function createMockAssetManager(): AssetManager {
    // TODO: implementacja dla testów
    return null as any;
}