/**
 * @file AssetLoader.ts
 * @description Ładowanie assetów z różnych źródeł
 */

import { AssetType, AssetMetadata, AssetState } from './AssetRegistry';
import { AssetCache } from './AssetCache';
import { Logger, LogCategory } from '@shared-core/utils/Logger';
import { EventEmitter } from '@shared-core/events/EventEmitter';

/**
 | Postęp ładowania
 */
export interface LoadProgress {
    assetId: string;
    loaded: number;
    total: number;
    percent: number;
}

/**
 | Wynik ładowania
 */
export interface LoadResult<T = any> {
    assetId: string;
    data: T;
    metadata: AssetMetadata;
    duration: number;
}

/**
 | Opcje ładowania
 */
export interface LoadOptions {
    priority: number;           // Priorytet (0-100)
    timeout: number;             // Timeout w ms
    retries: number;             // Liczba prób
    cache: boolean;              // Czy używać cache
    validate: boolean;           // Czy walidować po załadowaniu
}

/**
 | Ładowarka assetów
 */
export class AssetLoader extends EventEmitter {
    private cache: AssetCache;
    private logger: Logger;
    private loadingQueue: Map<string, Promise<LoadResult>> = new Map();
    private options: LoadOptions;

    constructor(cache: AssetCache, options?: Partial<LoadOptions>) {
        super();
        
        this.cache = cache;
        this.logger = Logger.getInstance();
        
        this.options = {
            priority: 50,
            timeout: 30000,
            retries: 3,
            cache: true,
            validate: true,
            ...options
        };
    }

    /**
     | Ładuje asset
     */
    async load<T = any>(
        metadata: AssetMetadata,
        options?: Partial<LoadOptions>
    ): Promise<LoadResult<T>> {
        const opts = { ...this.options, ...options };

        // Sprawdź cache
        if (opts.cache) {
            const cached = this.cache.get<T>(metadata.id);
            if (cached) {
                this.logger.debug(LogCategory.SYSTEM, `Cache hit: ${metadata.id}`);
                return {
                    assetId: metadata.id,
                    data: cached,
                    metadata,
                    duration: 0
                };
            }
        }

        // Sprawdź czy już ładujemy
        const existing = this.loadingQueue.get(metadata.id);
        if (existing) {
            return existing as Promise<LoadResult<T>>;
        }

        // Rozpocznij ładowanie
        const promise = this.loadWithRetry(metadata, opts);
        this.loadingQueue.set(metadata.id, promise);

        try {
            const result = await promise;
            return result;
        } finally {
            this.loadingQueue.delete(metadata.id);
        }
    }

    /**
     | Ładuje wiele assetów jednocześnie
     */
    async loadMany(
        assets: AssetMetadata[],
        options?: Partial<LoadOptions>
    ): Promise<LoadResult[]> {
        const results = await Promise.allSettled(
            assets.map(asset => this.load(asset, options))
        );

        const succeeded: LoadResult[] = [];
        const failed: { assetId: string; error: any }[] = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled') {
                succeeded.push(result.value);
            } else {
                failed.push({
                    assetId: assets[i].id,
                    error: result.reason
                });
            }
        }

        if (failed.length > 0) {
            this.logger.warn(LogCategory.SYSTEM, 
                `Failed to load ${failed.length}/${assets.length} assets`);
        }

        return succeeded;
    }

    /**
     | Ładuje z ponownymi próbami
     */
    private async loadWithRetry<T>(
        metadata: AssetMetadata,
        options: LoadOptions
    ): Promise<LoadResult<T>> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= options.retries; attempt++) {
            try {
                const result = await this.loadSingle<T>(metadata, options);
                
                // Zapisz w cache
                if (options.cache) {
                    this.cache.set(metadata.id, result.data);
                }

                return result;
            } catch (error) {
                lastError = error as Error;
                this.logger.warn(LogCategory.SYSTEM, 
                    `Load attempt ${attempt + 1}/${options.retries + 1} failed for ${metadata.id}`);
                
                if (attempt < options.retries) {
                    await this.delay(1000 * (attempt + 1)); // Exponential backoff
                }
            }
        }

        throw lastError || new Error(`Failed to load asset: ${metadata.id}`);
    }

    /**
     | Ładuje pojedynczy asset
     */
    private async loadSingle<T>(
        metadata: AssetMetadata,
        options: LoadOptions
    ): Promise<LoadResult<T>> {
        const startTime = performance.now();

        // Emituj rozpoczęcie
        this.emit('load:start', { assetId: metadata.id });

        try {
            let data: T;

            switch (metadata.type) {
                case AssetType.TEXTURE:
                case AssetType.SPRITE:
                    data = await this.loadImage(metadata.path) as any;
                    break;
                    
                case AssetType.AUDIO:
                    data = await this.loadAudio(metadata.path) as any;
                    break;
                    
                case AssetType.JSON:
                    data = await this.loadJSON(metadata.path) as any;
                    break;
                    
                case AssetType.FONT:
                    data = await this.loadFont(metadata.path) as any;
                    break;
                    
                default:
                    data = await this.loadBinary(metadata.path) as any;
            }

            // Walidacja
            if (options.validate) {
                this.validateAsset(metadata, data);
            }

            const duration = performance.now() - startTime;

            // Emituj zakończenie
            this.emit('load:complete', {
                assetId: metadata.id,
                duration,
                size: metadata.size
            });

            return {
                assetId: metadata.id,
                data,
                metadata,
                duration
            };

        } catch (error) {
            this.emit('load:error', {
                assetId: metadata.id,
                error
            });
            throw error;
        }
    }

    /**
     | Ładuje obraz
     */
    private loadImage(path: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
            img.src = path;
        });
    }

    /**
     | Ładuje audio
     */
    private loadAudio(path: string): Promise<HTMLAudioElement> {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => resolve(audio);
            audio.onerror = () => reject(new Error(`Failed to load audio: ${path}`));
            audio.src = path;
        });
    }

    /**
     | Ładuje JSON
     */
    private async loadJSON(path: string): Promise<any> {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${path}`);
        }
        return response.json();
    }

    /**
     | Ładuje font
     */
    private async loadFont(path: string): Promise<FontFace> {
        const font = new FontFace('custom-font', `url(${path})`);
        await font.load();
        document.fonts.add(font);
        return font;
    }

    /**
     | Ładuje binarkę
     */
    private async loadBinary(path: string): Promise<ArrayBuffer> {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${path}`);
        }
        return response.arrayBuffer();
    }

    /**
     | Waliduje asset
     */
    private validateAsset(metadata: AssetMetadata, data: any): void {
        // Sprawdź rozmiar
        if (data instanceof HTMLImageElement) {
            // TODO: walidacja wymiarów
        }
        
        // Sprawdź sumę kontrolną (opcjonalnie)
        if (metadata.checksum) {
            // TODO: oblicz i porównaj checksum
        }
    }

    /**
     | Opóźnienie
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     | Przetwarza kolejkę priorytetowo
     */
    async processQueue(assets: AssetMetadata[], concurrency: number = 4): Promise<void> {
        // Sortuj według priorytetu
        const sorted = [...assets].sort((a, b) => b.priority - a.priority);
        
        const chunks: AssetMetadata[][] = [];
        for (let i = 0; i < sorted.length; i += concurrency) {
            chunks.push(sorted.slice(i, i + concurrency));
        }

        for (const chunk of chunks) {
            await Promise.all(chunk.map(asset => this.load(asset)));
        }
    }

    /**
     | Anuluje ładowanie
     */
    cancel(assetId: string): void {
        // TODO: implementacja anulowania
        this.loadingQueue.delete(assetId);
    }

    /**
     | Pobiera postęp
     */
    getProgress(assetId: string): LoadProgress | null {
        // TODO: rzeczywisty postęp
        return null;
    }

    /**
     | Zwalnia zasoby
     */
    dispose(): void {
        this.loadingQueue.clear();
        this.removeAllListeners();
    }
}