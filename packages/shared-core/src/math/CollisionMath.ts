/**
 * @file CollisionMath.ts
 * @description Funkcje do detekcji kolizji i geometrii
 */

import { Vector2 } from './Vector2';
import { clamp } from './Clamp';

/**
 * Interfejs koła
 */
export interface Circle {
    x: number;
    y: number;
    radius: number;
}

/**
 * Interfejs prostokąta
 */
export interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Interfejs linii
 */
export interface Line {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/**
 * Interfejs trójkąta
 */
export interface Triangle {
    x1: number; y1: number;
    x2: number; y2: number;
    x3: number; y3: number;
}

/**
 * Wynik kolizji
 */
export interface CollisionResult {
    collides: boolean;
    point?: Vector2;
    normal?: Vector2;
    depth?: number;
    time?: number;
}

/**
 * Sprawdza kolizję koło-koło
 */
export function circleCircle(c1: Circle, c2: Circle): boolean {
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < c1.radius + c2.radius;
}

/**
 * Sprawdza kolizję koło-koło i zwraca szczegóły
 */
export function circleCircleDetailed(c1: Circle, c2: Circle): CollisionResult {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radiiSum = c1.radius + c2.radius;
    
    if (distance >= radiiSum) {
        return { collides: false };
    }
    
    const depth = radiiSum - distance;
    const normal = new Vector2(dx / distance, dy / distance);
    const point = new Vector2(
        c1.x + normal.x * c1.radius,
        c1.y + normal.y * c1.radius
    );
    
    return {
        collides: true,
        point,
        normal,
        depth
    };
}

/**
 * Sprawdza kolizję punkt-koło
 */
export function pointCircle(px: number, py: number, circle: Circle): boolean {
    const dx = px - circle.x;
    const dy = py - circle.y;
    return (dx * dx + dy * dy) <= circle.radius * circle.radius;
}

/**
 * Sprawdza kolizję punkt-prostokąt
 */
export function pointRect(px: number, py: number, rect: Rectangle): boolean {
    return px >= rect.x && 
           px <= rect.x + rect.width && 
           py >= rect.y && 
           py <= rect.y + rect.height;
}

/**
 * Sprawdza kolizję koło-prostokąt
 */
export function circleRect(circle: Circle, rect: Rectangle): boolean {
    const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
    const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
    
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < circle.radius;
}

/**
 * Sprawdza kolizję koło-prostokąt i zwraca szczegóły
 */
export function circleRectDetailed(circle: Circle, rect: Rectangle): CollisionResult {
    const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
    const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
    
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance >= circle.radius) {
        return { collides: false };
    }
    
    const depth = circle.radius - distance;
    const normal = distance > 0 
        ? new Vector2(dx / distance, dy / distance)
        : new Vector2(0, 1); // domyślnie w górę jeśli w środku
    
    const point = new Vector2(closestX, closestY);
    
    return {
        collides: true,
        point,
        normal,
        depth
    };
}

/**
 * Sprawdza kolizję prostokąt-prostokąt
 */
export function rectRect(r1: Rectangle, r2: Rectangle): boolean {
    return !(r2.x > r1.x + r1.width ||
             r2.x + r2.width < r1.x ||
             r2.y > r1.y + r1.height ||
             r2.y + r2.height < r1.y);
}

/**
 * Sprawdza kolizję linia-koło
 */
export function lineCircle(line: Line, circle: Circle): boolean {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const fx = line.x1 - circle.x;
    const fy = line.y1 - circle.y;
    
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - circle.radius * circle.radius;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return false;
    
    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
    
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

/**
 * Sprawdza kolizję linia-linia i zwraca punkt przecięcia
 */
export function lineLine(l1: Line, l2: Line): Vector2 | null {
    const x1 = l1.x1, y1 = l1.y1, x2 = l1.x2, y2 = l1.y2;
    const x3 = l2.x1, y3 = l2.y1, x4 = l2.x2, y4 = l2.y2;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom === 0) return null;
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        const x = x1 + t * (x2 - x1);
        const y = y1 + t * (y2 - y1);
        return new Vector2(x, y);
    }
    
    return null;
}

/**
 * Sprawdza czy punkt jest w trójkącie
 */
export function pointInTriangle(px: number, py: number, tri: Triangle): boolean {
    const { x1, y1, x2, y2, x3, y3 } = tri;
    
    const v0x = x3 - x1;
    const v0y = y3 - y1;
    const v1x = x2 - x1;
    const v1y = y2 - y1;
    const v2x = px - x1;
    const v2y = py - y1;
    
    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;
    
    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
    
    return (u >= 0) && (v >= 0) && (u + v < 1);
}

/**
 * Oblicza pole trójkąta
 */
export function triangleArea(tri: Triangle): number {
    const { x1, y1, x2, y2, x3, y3 } = tri;
    return Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2);
}

/**
 * Oblicza środek masy trójkąta
 */
export function triangleCentroid(tri: Triangle): Vector2 {
    const { x1, y1, x2, y2, x3, y3 } = tri;
    return new Vector2(
        (x1 + x2 + x3) / 3,
        (y1 + y2 + y3) / 3
    );
}

/**
 * Sprawdza kolizję odcinka z prostokątem
 */
export function lineRect(line: Line, rect: Rectangle): boolean {
    // Sprawdź czy któryś koniec jest w prostokącie
    if (pointRect(line.x1, line.y1, rect) || pointRect(line.x2, line.y2, rect)) {
        return true;
    }
    
    // Sprawdź przecięcia z krawędziami
    const left: Line = { x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.height };
    const right: Line = { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height };
    const top: Line = { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y };
    const bottom: Line = { x1: rect.x, y1: rect.y + rect.height, x2: rect.x + rect.width, y2: rect.y + rect.height };
    
    return lineLine(line, left) !== null ||
           lineLine(line, right) !== null ||
           lineLine(line, top) !== null ||
           lineLine(line, bottom) !== null;
}

/**
 * Sprawdza czy punkt jest w kole (wektorowo)
 */
export function pointInCircle(point: Vector2, circle: Circle): boolean {
    return pointCircle(point.x, point.y, circle);
}

/**
 * Sprawdza czy punkt jest w prostokącie (wektorowo)
 */
export function pointInRect(point: Vector2, rect: Rectangle): boolean {
    return pointRect(point.x, point.y, rect);
}

/**
 * Znajduje najbliższy punkt na okręgu do punktu
 */
export function closestPointOnCircle(point: Vector2, circle: Circle): Vector2 {
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
        return new Vector2(circle.x + circle.radius, circle.y);
    }
    
    return new Vector2(
        circle.x + (dx / distance) * circle.radius,
        circle.y + (dy / distance) * circle.radius
    );
}

/**
 * Znajduje najbliższy punkt na prostokącie do punktu
 */
export function closestPointOnRect(point: Vector2, rect: Rectangle): Vector2 {
    const cx = clamp(point.x, rect.x, rect.x + rect.width);
    const cy = clamp(point.y, rect.y, rect.y + rect.height);
    return new Vector2(cx, cy);
}

/**
 * Sprawdza czy dwa okręgi nachodzą na siebie i zwraca głębokość penetracji
 */
export function circlePenetration(c1: Circle, c2: Circle): number {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radiiSum = c1.radius + c2.radius;
    
    if (distance >= radiiSum) return 0;
    return radiiSum - distance;
}

/**
 * Oblicza wektor odepchnięcia dla dwóch kół
 */
export function circleSeparationVector(c1: Circle, c2: Circle): Vector2 {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
        return new Vector2(1, 0); // losowy kierunek
    }
    
    const penetration = circlePenetration(c1, c2);
    if (penetration <= 0) return Vector2.zero();
    
    const nx = dx / distance;
    const ny = dy / distance;
    
    return new Vector2(nx * penetration / 2, ny * penetration / 2);
}

/**
 * Sprawdza czy okrąg jest w całości w prostokącie
 */
export function circleFullyInsideRect(circle: Circle, rect: Rectangle): boolean {
    return circle.x - circle.radius >= rect.x &&
           circle.x + circle.radius <= rect.x + rect.width &&
           circle.y - circle.radius >= rect.y &&
           circle.y + circle.radius <= rect.y + rect.height;
}

/**
 * Oblicza bounding box dla okręgu
 */
export function circleBoundingBox(circle: Circle): Rectangle {
    return {
        x: circle.x - circle.radius,
        y: circle.y - circle.radius,
        width: circle.radius * 2,
        height: circle.radius * 2
    };
}

/**
 * Oblicza bounding box dla zbioru punktów
 */
export function pointsBoundingBox(points: Vector2[]): Rectangle {
    if (points.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}