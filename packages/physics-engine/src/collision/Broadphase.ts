/**
 * @file Broadphase.ts
 * @description Szybka faza detekcji kolizji - znajduje potencjalne pary
 */

import { Body, AABB, aabbOverlap } from '../bodies/Body';
import { SpatialGrid } from '@spatial-hash/Grid';
import { Vector2 } from '@shared-core/math/Vector2';

/**
 * Typ broad phase
 */
export enum BroadPhaseType {
    BRUTE_FORCE = 'brute_force',
    SPATIAL_HASH = 'spatial_hash',
    QUAD_TREE = 'quad_tree',
    BVH = 'bvh'
}

/**
 * Para potencjalnie kolidujących ciał
 */
export interface PotentialPair {
    bodyA: Body;
    bodyB: Body;
}

/**
 * Opcje broad phase
 */
export interface BroadPhaseOptions {
    cellSize?: number;
    maxBodiesPerCell?: number;
    enableDynamicTree?: boolean;
}

/**
 * Bazowa klasa dla broad phase
 */
export abstract class BroadPhase {
    protected bodies: Set<Body> = new Set();
    protected options: BroadPhaseOptions;

    constructor(options: BroadPhaseOptions = {}) {
        this.options = {
            cellSize: 100,
            maxBodiesPerCell: 10,
            enableDynamicTree: true,
            ...options
        };
    }

    /**
     * Dodaje ciało do struktury
     */
    abstract insert(body: Body): void;

    /**
     * Usuwa ciało ze struktury
     */
    abstract remove(body: Body): void;

    /**
     * Aktualizuje pozycję ciała
     */
    abstract update(body: Body): void;

    /**
     * Aktualizuje wszystkie ciała
     */
    abstract updateAll(): void;

    /**
     * Wykonuje zapytanie o potencjalne pary
     */
    abstract query(): PotentialPair[];

    /**
     * Wykonuje zapytanie o ciała w AABB
     */
    abstract queryAABB(aabb: AABB): Body[];

    /**
     * Czyści strukturę
     */
    abstract clear(): void;

    /**
     * Tworzy instancję broad phase
     */
    static create(type: BroadPhaseType, options?: BroadPhaseOptions): BroadPhase {
        switch (type) {
            case BroadPhaseType.BRUTE_FORCE:
                return new BruteForceBroadPhase(options);
            case BroadPhaseType.SPATIAL_HASH:
                return new SpatialHashBroadPhase(options);
            case BroadPhaseType.QUAD_TREE:
                return new QuadTreeBroadPhase(options);
            case BroadPhaseType.BVH:
                return new BVHBroadPhase(options);
            default:
                return new SpatialHashBroadPhase(options);
        }
    }
}

/**
 * Brute force - O(n²) - tylko do debugowania
 */
export class BruteForceBroadPhase extends BroadPhase {
    insert(body: Body): void {
        this.bodies.add(body);
    }

    remove(body: Body): void {
        this.bodies.delete(body);
    }

    update(body: Body): void {
        // Nic nie robi
    }

    updateAll(): void {
        // Nic nie robi
    }

    query(): PotentialPair[] {
        const pairs: PotentialPair[] = [];
        const bodiesArray = Array.from(this.bodies);

        for (let i = 0; i < bodiesArray.length; i++) {
            for (let j = i + 1; j < bodiesArray.length; j++) {
                const bodyA = bodiesArray[i];
                const bodyB = bodiesArray[j];

                // Sprawdź AABB
                if (aabbOverlap(bodyA.aabb, bodyB.aabb)) {
                    pairs.push({ bodyA, bodyB });
                }
            }
        }

        return pairs;
    }

    queryAABB(aabb: AABB): Body[] {
        return Array.from(this.bodies).filter(body => aabbOverlap(body.aabb, aabb));
    }

    clear(): void {
        this.bodies.clear();
    }
}

/**
 * Spatial hash - O(n) z dobrym rozkładem
 */
export class SpatialHashBroadPhase extends BroadPhase {
    private grid: SpatialGrid<Body>;
    private bodyCells: Map<Body, Set<string>> = new Map();

    constructor(options: BroadPhaseOptions = {}) {
        super(options);
        this.grid = new SpatialGrid<Body>({
            cellSize: options.cellSize || 100,
            initialCapacity: 1000
        });
    }

    insert(body: Body): void {
        this.bodies.add(body);
        this.update(body);
    }

    remove(body: Body): void {
        this.bodies.delete(body);
        
        const cells = this.bodyCells.get(body);
        if (cells) {
            for (const cellKey of cells) {
                this.grid.remove(cellKey, body);
            }
            this.bodyCells.delete(body);
        }
    }

    update(body: Body): void {
        // Usuń z poprzednich komórek
        const oldCells = this.bodyCells.get(body);
        if (oldCells) {
            for (const cellKey of oldCells) {
                this.grid.remove(cellKey, body);
            }
        }

        // Oblicz nowe komórki
        const newCells = new Set<string>();
        const aabb = body.aabb;

        const minX = Math.floor(aabb.minX / this.options.cellSize!);
        const maxX = Math.floor(aabb.maxX / this.options.cellSize!);
        const minY = Math.floor(aabb.minY / this.options.cellSize!);
        const maxY = Math.floor(aabb.maxY / this.options.cellSize!);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const cellKey = `${x}:${y}`;
                this.grid.insert(cellKey, body);
                newCells.add(cellKey);
            }
        }

        this.bodyCells.set(body, newCells);
    }

    updateAll(): void {
        for (const body of this.bodies) {
            this.update(body);
        }
    }

    query(): PotentialPair[] {
        const pairs = new Set<string>();
        const result: PotentialPair[] = [];

        for (const [cellKey, bodies] of this.grid.getAllCells()) {
            const bodiesArray = Array.from(bodies);

            for (let i = 0; i < bodiesArray.length; i++) {
                for (let j = i + 1; j < bodiesArray.length; j++) {
                    const bodyA = bodiesArray[i];
                    const bodyB = bodiesArray[j];
                    
                    // Użyj ID do unikalności pary
                    const pairId = bodyA.id < bodyB.id 
                        ? `${bodyA.id}:${bodyB.id}`
                        : `${bodyB.id}:${bodyA.id}`;

                    if (!pairs.has(pairId)) {
                        pairs.add(pairId);
                        result.push({ bodyA, bodyB });
                    }
                }
            }
        }

        return result;
    }

    queryAABB(aabb: AABB): Body[] {
        const result = new Set<Body>();
        
        const minX = Math.floor(aabb.minX / this.options.cellSize!);
        const maxX = Math.floor(aabb.maxX / this.options.cellSize!);
        const minY = Math.floor(aabb.minY / this.options.cellSize!);
        const maxY = Math.floor(aabb.maxY / this.options.cellSize!);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const cellKey = `${x}:${y}`;
                const bodies = this.grid.getCell(cellKey);
                if (bodies) {
                    for (const body of bodies) {
                        if (aabbOverlap(body.aabb, aabb)) {
                            result.add(body);
                        }
                    }
                }
            }
        }

        return Array.from(result);
    }

    clear(): void {
        this.bodies.clear();
        this.grid.clear();
        this.bodyCells.clear();
    }
}

/**
 * Quad tree - do nierównomiernego rozkładu
 */
export class QuadTreeBroadPhase extends BroadPhase {
    private root: QuadTreeNode;
    private bodyNodes: Map<Body, Set<QuadTreeNode>> = new Map();

    constructor(options: BroadPhaseOptions = {}) {
        super(options);
        
        // Zakładamy świat 10000x10000
        this.root = new QuadTreeNode(
            new AABBImpl(-5000, -5000, 15000, 15000),
            0,
            options.maxBodiesPerCell || 10
        );
    }

    insert(body: Body): void {
        this.bodies.add(body);
        this.insertIntoNode(this.root, body);
    }

    private insertIntoNode(node: QuadTreeNode, body: Body): void {
        if (!node.aabb.overlaps(body.aabb)) return;

        if (node.isLeaf()) {
            node.bodies.push(body);
            
            // Podziel jeśli przekroczono limit
            if (node.bodies.length > this.options.maxBodiesPerCell! && node.depth < 10) {
                this.splitNode(node);
            }
        } else {
            for (const child of node.children) {
                this.insertIntoNode(child, body);
            }
        }
    }

    private splitNode(node: QuadTreeNode): void {
        const centerX = (node.aabb.minX + node.aabb.maxX) / 2;
        const centerY = (node.aabb.minY + node.aabb.maxY) / 2;

        node.children = [
            new QuadTreeNode(new AABBImpl(node.aabb.minX, node.aabb.minY, centerX, centerY), node.depth + 1),
            new QuadTreeNode(new AABBImpl(centerX, node.aabb.minY, node.aabb.maxX, centerY), node.depth + 1),
            new QuadTreeNode(new AABBImpl(node.aabb.minX, centerY, centerX, node.aabb.maxY), node.depth + 1),
            new QuadTreeNode(new AABBImpl(centerX, centerY, node.aabb.maxX, node.aabb.maxY), node.depth + 1)
        ];

        // Przenieś ciała do dzieci
        for (const body of node.bodies) {
            for (const child of node.children) {
                if (child.aabb.overlaps(body.aabb)) {
                    child.bodies.push(body);
                }
            }
        }

        node.bodies = [];
    }

    remove(body: Body): void {
        this.bodies.delete(body);
        // Usuwanie z drzewa - do implementacji
    }

    update(body: Body): void {
        // Na razie prosto - usuń i dodaj
        this.remove(body);
        this.insert(body);
    }

    updateAll(): void {
        this.root = new QuadTreeNode(
            new AABBImpl(-5000, -5000, 15000, 15000),
            0,
            this.options.maxBodiesPerCell || 10
        );
        
        for (const body of this.bodies) {
            this.insertIntoNode(this.root, body);
        }
    }

    query(): PotentialPair[] {
        const pairs = new Set<string>();
        const result: PotentialPair[] = [];

        this.queryNode(this.root, pairs, result);

        return result;
    }

    private queryNode(node: QuadTreeNode, pairs: Set<string>, result: PotentialPair[]): void {
        if (node.isLeaf()) {
            // Sprawdź pary w tym liściu
            for (let i = 0; i < node.bodies.length; i++) {
                for (let j = i + 1; j < node.bodies.length; j++) {
                    const bodyA = node.bodies[i];
                    const bodyB = node.bodies[j];
                    
                    const pairId = bodyA.id < bodyB.id 
                        ? `${bodyA.id}:${bodyB.id}`
                        : `${bodyB.id}:${bodyA.id}`;

                    if (!pairs.has(pairId) && aabbOverlap(bodyA.aabb, bodyB.aabb)) {
                        pairs.add(pairId);
                        result.push({ bodyA, bodyB });
                    }
                }
            }
        } else {
            for (const child of node.children) {
                this.queryNode(child, pairs, result);
            }
        }
    }

    queryAABB(aabb: AABB): Body[] {
        const result = new Set<Body>();
        this.queryAABBNode(this.root, aabb, result);
        return Array.from(result);
    }

    private queryAABBNode(node: QuadTreeNode, aabb: AABB, result: Set<Body>): void {
        if (!node.aabb.overlaps(aabb)) return;

        if (node.isLeaf()) {
            for (const body of node.bodies) {
                if (aabbOverlap(body.aabb, aabb)) {
                    result.add(body);
                }
            }
        } else {
            for (const child of node.children) {
                this.queryAABBNode(child, aabb, result);
            }
        }
    }

    clear(): void {
        this.bodies.clear();
        this.root = new QuadTreeNode(
            new AABBImpl(-5000, -5000, 15000, 15000),
            0,
            this.options.maxBodiesPerCell || 10
        );
        this.bodyNodes.clear();
    }
}

/**
 * BVH - Bounding Volume Hierarchy
 */
export class BVHBroadPhase extends BroadPhase {
    private root: BVHNode | null = null;

    insert(body: Body): void {
        this.bodies.add(body);
        
        if (!this.root) {
            this.root = new BVHLeaf(body);
        } else {
            this.root = this.insertIntoBVH(this.root, body);
        }
    }

    private insertIntoBVH(node: BVHNode, body: Body): BVHNode {
        if (node.isLeaf()) {
            // Liść - utwórz nowy węzeł wewnętrzny
            return new BVHInternal(node, new BVHLeaf(body));
        }

        // Węzeł wewnętrzny - wybierz lepsze dziecko
        const costLeft = this.cost(node.left, body);
        const costRight = this.cost(node.right, body);

        if (costLeft < costRight) {
            node.left = this.insertIntoBVH(node.left, body);
        } else {
            node.right = this.insertIntoBVH(node.right, body);
        }

        node.updateAABB();
        return node;
    }

    private cost(node: BVHNode, body: Body): number {
        const union = aabbUnion(node.aabb, body.aabb);
        return union.area();
    }

    remove(body: Body): void {
        this.bodies.delete(body);
        // Usuwanie z BVH - do implementacji
    }

    update(body: Body): void {
        // Usuń i dodaj
        this.remove(body);
        this.insert(body);
    }

    updateAll(): void {
        this.root = null;
        for (const body of this.bodies) {
            this.insert(body);
        }
    }

    query(): PotentialPair[] {
        const pairs = new Set<string>();
        const result: PotentialPair[] = [];

        if (this.root) {
            this.queryBVHNode(this.root, pairs, result);
        }

        return result;
    }

    private queryBVHNode(node: BVHNode, pairs: Set<string>, result: PotentialPair[]): void {
        if (node.isLeaf()) {
            // Liść - porównaj z innymi liśćmi
            // To wymaga bardziej zaawansowanego algorytmu
            return;
        }

        // Rekurencyjnie sprawdzaj dzieci
        this.queryBVHNode(node.left, pairs, result);
        this.queryBVHNode(node.right, pairs, result);
    }

    queryAABB(aabb: AABB): Body[] {
        const result: Body[] = [];
        if (this.root) {
            this.queryAABBNode(this.root, aabb, result);
        }
        return result;
    }

    private queryAABBNode(node: BVHNode, aabb: AABB, result: Body[]): void {
        if (!aabbOverlap(node.aabb, aabb)) return;

        if (node.isLeaf()) {
            if (aabbOverlap(node.body.aabb, aabb)) {
                result.push(node.body);
            }
        } else {
            this.queryAABBNode(node.left, aabb, result);
            this.queryAABBNode(node.right, aabb, result);
        }
    }

    clear(): void {
        this.bodies.clear();
        this.root = null;
    }
}

/**
 * Pomocnicze klasy dla struktur danych
 */

class AABBImpl implements AABB {
    constructor(
        public minX: number,
        public minY: number,
        public maxX: number,
        public maxY: number
    ) {}

    overlaps(other: AABB): boolean {
        return !(this.maxX < other.minX || this.minX > other.maxX ||
                this.maxY < other.minY || this.minY > other.maxY);
    }

    area(): number {
        return (this.maxX - this.minX) * (this.maxY - this.minY);
    }
}

class QuadTreeNode {
    public children: QuadTreeNode[] = [];
    public bodies: Body[] = [];

    constructor(
        public aabb: AABBImpl,
        public depth: number,
        public maxBodiesPerCell: number
    ) {}

    isLeaf(): boolean {
        return this.children.length === 0;
    }
}

abstract class BVHNode {
    abstract aabb: AABB;
    abstract isLeaf(): boolean;
    abstract updateAABB(): void;
}

class BVHLeaf extends BVHNode {
    aabb: AABB;

    constructor(public body: Body) {
        super();
        this.aabb = { ...body.aabb };
    }

    isLeaf(): boolean {
        return true;
    }

    updateAABB(): void {
        this.aabb = { ...this.body.aabb };
    }
}

class BVHInternal extends BVHNode {
    aabb: AABB;

    constructor(
        public left: BVHNode,
        public right: BVHNode
    ) {
        super();
        this.aabb = this.combineAABBs(left.aabb, right.aabb);
    }

    private combineAABBs(a: AABB, b: AABB): AABB {
        return {
            minX: Math.min(a.minX, b.minX),
            minY: Math.min(a.minY, b.minY),
            maxX: Math.max(a.maxX, b.maxX),
            maxY: Math.max(a.maxY, b.maxY)
        };
    }

    isLeaf(): boolean {
        return false;
    }

    updateAABB(): void {
        this.aabb = this.combineAABBs(this.left.aabb, this.right.aabb);
    }
}

// Helper dla AABB
function aabbUnion(a: AABB, b: AABB): AABBImpl {
    return new AABBImpl(
        Math.min(a.minX, b.minX),
        Math.min(a.minY, b.minY),
        Math.max(a.maxX, b.maxX),
        Math.max(a.maxY, b.maxY)
    );
}