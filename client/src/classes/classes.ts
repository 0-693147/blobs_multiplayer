import * as math from 'mathjs';

export type Vector = [number, number]
export type CollisionObject = Enemy | Player | Projectile;
export let marks_on = {state: false};


const canvas = document.querySelector("canvas")!;
const con : any = canvas.getContext("2d");

export class GameEntity {
    pos: Vector;
    trail: Vector[];
    id: number;
    creationTime: number;
    terminationTime: number;
    collisionImmunityTime: number;

    constructor(pos : Vector) {
        this.pos = pos
        this.id = Math.random();
        this.creationTime = new Date().getTime()
        this.terminationTime = Infinity;
        this.collisionImmunityTime = 0;
        this.trail = [pos];
    }
}

export class Blob extends GameEntity {
    radius: number;
    color: string;

    constructor(pos: Vector, radius: number, color: string) {
        super(pos)
        this.radius = radius;
        this.color = color;
    }

    draw() {
        con.beginPath();
        con.arc(this.pos[0], this.pos[1], this.radius, 0, Math.PI*2, true);
        con.fillStyle = this.color;
        con.fill();
    }

}

export class Mark extends GameEntity {
    vector: Vector;
    endpoint: Vector;
    color: string;

    constructor(pos: Vector, vector: Vector, color: string = "red") {
        super(pos);
        this.vector = vector;
        this.endpoint = math.add(this.pos, this.vector);
        this.color = color;

    }

    update(pos?: Vector, vector?: Vector) {
        if (pos) this.pos = pos
        if (vector) this.vector = vector
        if (pos && vector) this.endpoint = math.add(pos, vector);
        this.draw();
    }
    
    draw() {
        con.beginPath();
        con.moveTo(...this.pos);
        con.lineTo(...this.endpoint);
        con.strokeStyle = this.color;
        con.lineWidth = 2;
        con.stroke();
    }
}

export class TemporaryMark extends Mark {
    constructor(pos: Vector, vector: Vector, color?: string) {
        if (color) super(pos, vector, color);
        else super(pos, vector);
    }

    update() {
        this.draw();
        this.terminationTime = 0;
    }
}

export class MovingBlob extends Blob {
    velocity: Vector;

    constructor(pos: Vector, radius: number, color: string, velocity: Vector) {
        super(pos, radius, color);
        this.velocity = velocity;
    }

    update() {
        this.pos = math.add(this.pos, this.velocity)
        this.draw()
    }
}

export class Player extends MovingBlob {
    constructor({position, radius, color, velocity} : {position: Vector, radius: number, color: string, velocity?: Vector}) {
        if (! velocity) velocity = [0, 0];
        super(position, radius, color, velocity);
    }
}

export class Projectile extends MovingBlob {
    damage?: number; 

    constructor({pos, radius, color, velocity, damage}: {pos: Vector, radius: number, color: string, velocity: Vector, damage?: number}) {
        super(pos, radius, color, velocity);
        // this.damage = damage;
    }
}

export class Enemy extends MovingBlob {
    health: number;
    mark?: Mark;

    constructor({pos, radius, color, velocity} : {pos: Vector, radius: number, color: string, velocity: Vector}) {
        super(pos, radius, color, velocity);
        this.health = radius / 2;
        if (marks_on.state) {
            const scaling_factor = 60;
            this.mark = new Mark(pos, math.multiply(velocity, scaling_factor) as Vector);
        }
    }

    update() {
        super.update()
        if (marks_on.state) {
            const scaling_factor = 60;
            this.mark?.update(this.pos, math.multiply(this.velocity, scaling_factor) as Vector)
        }
    }
}

export class Particle extends MovingBlob {
    terminationTime: number;

    constructor(pos: Vector, radius: number, color: string, velocity: Vector) {
        super(pos, radius, color, velocity);
        this.terminationTime = new Date().getTime() + 2000;
    }
}
