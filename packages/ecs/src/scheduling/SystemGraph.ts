/**
 * @file SystemGraph.ts
 * @description Graf zależności między systemami
 */

import { System, SystemPhase } from '../core/System';

/**
 * Węzeł w grafie systemów
 */
export interface SystemNode {
    system: System;
    phase: SystemPhase;
    dependencies: Set<System>;
    dependents: Set<System>;
}

/**
 * Cykl w grafie zależności
 */
export class DependencyCycleError extends Error {
    constructor(public cycle: System[]) {
        super(`Cykl zależności wykryty: ${cycle.map(s => s.name).join(' -> ')}`);
    }
}

/**
 * Graf zależności między systemami
 */
export class SystemGraph {
    private nodes: Map<System, SystemNode> = new Map();
    private sorted: System[] = [];

    /**
     * Dodaje system do grafu
     */
    addSystem(system: System, phase: SystemPhase): void {
        if (!this.nodes.has(system)) {
            this.nodes.set(system, {
                system,
                phase,
                dependencies: new Set(),
                dependents: new Set()
            });
        }
    }

    /**
     * Dodaje zależność (system A zależy od systemu B)
     */
    addDependency(systemA: System, systemB: System): void {
        const nodeA = this.nodes.get(systemA);
        const nodeB = this.nodes.get(systemB);

        if (!nodeA || !nodeB) {
            throw new Error('System nie istnieje w grafie');
        }

        nodeA.dependencies.add(systemB);
        nodeB.dependents.add(systemA);
        
        // Inwaliduj sortowanie
        this.sorted = [];
    }

    /**
     * Usuwa system z grafu
     */
    removeSystem(system: System): void {
        const node = this.nodes.get(system);
        if (!node) return;

        // Usuń zależności
        for (const dep of node.dependencies) {
            const depNode = this.nodes.get(dep);
            if (depNode) {
                depNode.dependents.delete(system);
            }
        }

        // Usuń zależnych
        for (const dep of node.dependents) {
            const depNode = this.nodes.get(dep);
            if (depNode) {
                depNode.dependencies.delete(system);
            }
        }

        this.nodes.delete(system);
        this.sorted = [];
    }

    /**
     * Sortuje topologicznie systemy
     */
    topologicalSort(): System[] {
        if (this.sorted.length > 0) {
            return this.sorted;
        }

        const visited = new Set<System>();
        const stack = new Set<System>();
        const result: System[] = [];

        const visit = (system: System) => {
            if (stack.has(system)) {
                // Wykryto cykl
                const cycle = this.findCycle(system, stack);
                throw new DependencyCycleError(cycle);
            }

            if (visited.has(system)) return;

            visited.add(system);
            stack.add(system);

            const node = this.nodes.get(system);
            if (node) {
                for (const dep of node.dependencies) {
                    visit(dep);
                }
            }

            stack.delete(system);
            result.push(system);
        };

        // Odwiedź wszystkie systemy
        for (const system of this.nodes.keys()) {
            if (!visited.has(system)) {
                visit(system);
            }
        }

        this.sorted = result;
        return result;
    }

    /**
     * Znajduje cykl w grafie
     */
    private findCycle(start: System, stack: Set<System>): System[] {
        const cycle: System[] = [];
        let found = false;

        const dfs = (system: System, path: System[]) => {
            if (found) return;

            if (system === start && path.length > 0) {
                cycle.push(...path, start);
                found = true;
                return;
            }

            if (path.includes(system)) return;

            const node = this.nodes.get(system);
            if (!node) return;

            for (const dep of node.dependencies) {
                dfs(dep, [...path, system]);
            }
        };

        dfs(start, []);
        return cycle;
    }

    /**
     * Grupuje systemy według faz
     */
    groupByPhase(): Map<SystemPhase, System[]> {
        const groups = new Map<SystemPhase, System[]>();

        for (const [system, node] of this.nodes) {
            const phase = node.phase;
            if (!groups.has(phase)) {
                groups.set(phase, []);
            }
            groups.get(phase)!.push(system);
        }

        return groups;
    }

    /**
     * Sprawdza czy graf jest spójny
     */
    isConnected(): boolean {
        if (this.nodes.size === 0) return true;

        const visited = new Set<System>();
        const stack = [this.nodes.keys().next().value];

        while (stack.length > 0) {
            const system = stack.pop()!;
            if (visited.has(system)) continue;

            visited.add(system);
            const node = this.nodes.get(system);

            if (node) {
                stack.push(...node.dependencies);
                stack.push(...node.dependents);
            }
        }

        return visited.size === this.nodes.size;
    }

    /**
     * Znajduje systemy bez zależności
     */
    findRoots(): System[] {
        const roots: System[] = [];

        for (const [system, node] of this.nodes) {
            if (node.dependencies.size === 0) {
                roots.push(system);
            }
        }

        return roots;
    }

    /**
     * Znajduje systemy końcowe (bez zależnych)
     */
    findLeaves(): System[] {
        const leaves: System[] = [];

        for (const [system, node] of this.nodes) {
            if (node.dependents.size === 0) {
                leaves.push(system);
            }
        }

        return leaves;
    }

    /**
     * Głębokość systemu w grafie
     */
    getDepth(system: System): number {
        const node = this.nodes.get(system);
        if (!node) return -1;

        if (node.dependencies.size === 0) return 0;

        let maxDepth = 0;
        for (const dep of node.dependencies) {
            maxDepth = Math.max(maxDepth, this.getDepth(dep) + 1);
        }

        return maxDepth;
    }

    /**
     * Eksportuje graf do formatu DOT (Graphviz)
     */
    toDot(): string {
        let dot = 'digraph SystemGraph {\n';
        dot += '  rankdir=TB;\n';
        dot += '  node [shape=box, style=filled];\n\n';

        // Grupuj według faz
        const byPhase = this.groupByPhase();
        
        for (const [phase, systems] of byPhase) {
            dot += `  subgraph cluster_${phase} {\n`;
            dot += `    label = "${phase}";\n`;
            dot += `    color = blue;\n`;
            
            for (const system of systems) {
                dot += `    "${system.name}" [label="${system.name}"];\n`;
            }
            
            dot += '  }\n\n';
        }

        // Dodaj krawędzie
        for (const [system, node] of this.nodes) {
            for (const dep of node.dependencies) {
                dot += `  "${system.name}" -> "${dep.name}";\n`;
            }
        }

        dot += '}\n';
        return dot;
    }

    /**
     * Waliduje graf
     */
    validate(): string[] {
        const errors: string[] = [];

        try {
            this.topologicalSort();
        } catch (e) {
            if (e instanceof DependencyCycleError) {
                errors.push(e.message);
            }
        }

        // Sprawdź czy systemy w różnych fazach mają zależności
        for (const [system, node] of this.nodes) {
            for (const dep of node.dependencies) {
                const depNode = this.nodes.get(dep);
                if (depNode && depNode.phase !== node.phase) {
                    errors.push(`System ${system.name} (${node.phase}) zależy od ${dep.name} (${depNode.phase}) - różne fazy`);
                }
            }
        }

        return errors;
    }

    /**
     * Czyści graf
     */
    clear(): void {
        this.nodes.clear();
        this.sorted = [];
    }

    /**
     * Rozmiar grafu
     */
    get size(): number {
        return this.nodes.size;
    }
}