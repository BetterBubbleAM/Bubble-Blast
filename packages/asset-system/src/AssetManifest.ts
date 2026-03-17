/**
 * @file AssetManifest.ts
 * @description Manifest assetów - definiuje które assety są potrzebne
 */

import { AssetType, AssetMetadata } from './AssetRegistry';

/**
 | Grupa assetów
 */
export interface AssetGroup {
    id: string;
    name: string;
    assets: string[];           // ID assetów
    required: boolean;          // Czy grupa musi być załadowana
    loadPriority: number;        // Priorytet grupy
    dependencies: string[];      // ID grup od których zależy
}

/**
 | Wariant asseta
 */
export interface AssetVariant {
    id: string;
    condition: AssetCondition;
    assetId: string;
}

/**
 | Warunek dla wariantu
 */
export interface AssetCondition {
    platform?: 'web' | 'mobile' | 'desktop';
    quality?: 'low' | 'medium' | 'high';
    language?: string;
    feature?: string;
}

/**
 | Manifest assetów
 */
export interface AssetManifest {
    version: string;
    gameVersion: string;
    baseUrl: string;
    assets: AssetMetadata[];
    groups: AssetGroup[];
    variants: AssetVariant[];
    defaultQuality: 'low' | 'medium' | 'high';
    defaultLanguage: string;
}

/**
 | Manager manifestu
 */
export class ManifestManager {
    private manifest: AssetManifest | null = null;
    private groupMap: Map<string, AssetGroup> = new Map();
    private assetMap: Map<string, AssetMetadata> = new Map();
    private loaded: boolean = false;

    /**
     | Ładuje manifest
     */
    async loadManifest(url: string): Promise<AssetManifest> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load manifest: ${response.status}`);
        }

        this.manifest = await response.json();
        this.buildIndices();
        this.loaded = true;
        
        return this.manifest;
    }

    /**
     | Buduje indeksy
     */
    private buildIndices(): void {
        if (!this.manifest) return;

        // Indeksuj grupy
        for (const group of this.manifest.groups) {
            this.groupMap.set(group.id, group);
        }

        // Indeksuj assety
        for (const asset of this.manifest.assets) {
            this.assetMap.set(asset.id, asset);
        }
    }

    /**
     | Pobiera wszystkie assety
     */
    getAllAssets(): AssetMetadata[] {
        return this.manifest?.assets || [];
    }

    /**
     | Pobiera asset po ID
     */
    getAsset(assetId: string): AssetMetadata | undefined {
        return this.assetMap.get(assetId);
    }

    /**
     | Pobiera grupę po ID
     */
    getGroup(groupId: string): AssetGroup | undefined {
        return this.groupMap.get(groupId);
    }

    /**
     | Pobiera assety dla grupy
     */
    getGroupAssets(groupId: string): AssetMetadata[] {
        const group = this.groupMap.get(groupId);
        if (!group) return [];

        return group.assets
            .map(id => this.assetMap.get(id))
            .filter((a): a is AssetMetadata => !!a);
    }

    /**
     | Pobiera assety według typu
     */
    getAssetsByType(type: AssetType): AssetMetadata[] {
        return this.manifest?.assets.filter(a => a.type === type) || [];
    }

    /**
     | Pobiera assety według tagu
     */
    getAssetsByTag(tag: string): AssetMetadata[] {
        return this.manifest?.assets.filter(a => a.tags.includes(tag)) || [];
    }

    /**
     | Pobiera zależności grupy
     */
    getGroupDependencies(groupId: string): AssetGroup[] {
        const group = this.groupMap.get(groupId);
        if (!group) return [];

        return group.dependencies
            .map(id => this.groupMap.get(id))
            .filter((g): g is AssetGroup => !!g);
    }

    /**
     | Wybiera odpowiedni wariant
     */
    resolveVariant(assetId: string, conditions: AssetCondition): string {
        if (!this.manifest) return assetId;

        // Znajdź pasujące warianty
        const variants = this.manifest.variants.filter(v => v.assetId === assetId);
        
        for (const variant of variants) {
            if (this.matchesCondition(variant.condition, conditions)) {
                return variant.id;
            }
        }

        return assetId;
    }

    /**
     | Sprawdza czy warunek pasuje
     */
    private matchesCondition(variant: AssetCondition, required: AssetCondition): boolean {
        if (variant.platform && variant.platform !== required.platform) return false;
        if (variant.quality && variant.quality !== required.quality) return false;
        if (variant.language && variant.language !== required.language) return false;
        if (variant.feature && variant.feature !== required.feature) return false;
        
        return true;
    }

    /**
     | Tworzy listę assetów do załadowania
     */
    createLoadList(options: {
        groups?: string[];
        types?: AssetType[];
        tags?: string[];
        quality?: 'low' | 'medium' | 'high';
        language?: string;
    }): AssetMetadata[] {
        const assets = new Set<AssetMetadata>();

        // Dodaj z grup
        if (options.groups) {
            for (const groupId of options.groups) {
                const groupAssets = this.getGroupAssets(groupId);
                for (const asset of groupAssets) {
                    assets.add(asset);
                }

                // Dodaj zależności
                const dependencies = this.getGroupDependencies(groupId);
                for (const dep of dependencies) {
                    const depAssets = this.getGroupAssets(dep.id);
                    for (const asset of depAssets) {
                        assets.add(asset);
                    }
                }
            }
        }

        // Dodaj według typu
        if (options.types) {
            for (const type of options.types) {
                const typeAssets = this.getAssetsByType(type);
                for (const asset of typeAssets) {
                    assets.add(asset);
                }
            }
        }

        // Dodaj według tagów
        if (options.tags) {
            for (const tag of options.tags) {
                const tagAssets = this.getAssetsByTag(tag);
                for (const asset of tagAssets) {
                    assets.add(asset);
                }
            }
        }

        return Array.from(assets);
    }

    /**
     | Oblicza całkowity rozmiar assetów
     */
    calculateTotalSize(assets: AssetMetadata[]): number {
        return assets.reduce((sum, a) => sum + a.size, 0);
    }

    /**
     | Sprawdza czy manifest jest załadowany
     */
    isLoaded(): boolean {
        return this.loaded;
    }

    /**
     | Resetuje manager
     */
    reset(): void {
        this.manifest = null;
        this.groupMap.clear();
        this.assetMap.clear();
        this.loaded = false;
    }
}