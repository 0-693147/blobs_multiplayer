import express, { type Request, type Response } from "express";
import { createServer as createServerHTTP } from "http";
import { Server } from "socket.io";
import * as math from 'mathjs';
import * as uuid from "uuid";
import { readFileSync, readdirSync } from "fs";
import { createServer as createServerHTTPS } from "https"


const app = express();
const httpServer = createServerHTTP(app)

const privateKey = readFileSync('../server/certificate/self_signed_key.pem', 'utf8');
const certificate = readFileSync('../server/certificate/self_signed_cert.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };



const httpsServer = createServerHTTPS(credentials, app);

const io = new Server(httpsServer, {
    cors: {
        origin: "http://localhost:5173",
    },
    pingInterval: 2000,
    pingTimeout: 5000
});

const portHTTPS = 3999;
const portHTTP = portHTTPS - 1

httpsServer.listen(portHTTPS);
httpServer.listen(portHTTP);

app.use(express.static('../client/dist/'));

app.use((req, res, next) => {
    if (req.secure) {
        return next();
    }
    res.redirect('https://' + req.hostname + req.originalUrl);
})

app.get('/', function(req, res) {
  res.sendFile('client/dist/index.html', {root: "../"});
});

console.log("listening on " + String(portHTTPS));

type Vector = [number, number];

type Player = {
    position: Vector,
    color: string,
    radius: number,
    velocity: Vector,
    acceleration: Vector,
    score: number,
}

type Projectile = {
    position: Vector,
    color: string,
    player: string,
    velocity: Vector,
    radius: number,
    creationTime?: number
}


type Enemy = {
    position: Vector,
    color: string,
    velocity: Vector,
    creationTime?: number,
    radius: number
}

type CollisionObject = Enemy | Projectile;

const players: { [id: string] : Player } = {};
const projectiles: { [id: string] : Projectile } = {};
const enemies: { [id: string] : Enemy} = {};

const mapBorders: {x: Vector, y: Vector}= {x: [-5000, 5000], y: [-5000, 5000]};



io.on("connection", (socket) => {
    console.log("established connection");
    console.log("socket id:", socket.id);

    const playerSpawn: Vector = [500 * math.random(), 500 * math.random()];
    let projectileCount = 0;

    const color = `hsl(${Math.random() * 360}, 80%, 50%)`
    const thisPlayer = {
        position: playerSpawn,
        color: color,
        radius: 15,
        velocity: [0, 0] as Vector,
        acceleration: [0, 0] as Vector,
        score: 0,
    }

    players[socket.id] = thisPlayer;
    console.log("connected players:")
    socket.emit("playerInitialization", thisPlayer );

    socket.on("playerMoves", (keys : { [id : string] : {state : boolean}}) => {
        const acceleration_scalar = 1;
        let acceleration = [0, 0];
        
        if (keys["arrowUp"]?.state && keys["arrowRight"]?.state) {
            acceleration = math.multiply([1, 1], acceleration_scalar / Math.sqrt(2)) as Vector
        } else if (keys["arrowRight"]?.state && keys["arrowDown"]?.state) {
            acceleration = math.multiply([1, -1], acceleration_scalar / Math.sqrt(2)) as Vector
        } else if (keys["arrowDown"]?.state && keys["arrowLeft"]?.state) {
            acceleration = math.multiply([-1, -1], acceleration_scalar / Math.sqrt(2)) as Vector
        } else if (keys["arrowLeft"]?.state && keys["arrowUp"]?.state) {
            acceleration = math.multiply([-1, 1], acceleration_scalar / Math.sqrt(2)) as Vector
        } else if (keys["arrowUp"]?.state) acceleration = math.multiply([0, 1], acceleration_scalar) as Vector
        else if (keys["arrowDown"]?.state) acceleration = math.multiply([0, -1], acceleration_scalar) as Vector
        else if (keys["arrowRight"]?.state) acceleration = math.multiply([1, 0], acceleration_scalar) as Vector
        else if (keys["arrowLeft"]?.state) acceleration = math.multiply([-1, 0], acceleration_scalar) as Vector
        const thisPlayer = players[socket.id]
        if (thisPlayer) players[socket.id]!.acceleration = acceleration as Vector
    })

    socket.on("playerSendsProjectile", (projectileObject) => {
        const velocityScalar = 20;
        const x_velocity = math.cos(projectileObject.angle) * velocityScalar;
        const y_velocity = math.sin(projectileObject.angle) * velocityScalar;
        projectileCount += 1;
        projectiles[socket.id + "__" + String(projectileCount)] = {
            position: [...thisPlayer.position],
            color: thisPlayer.color,
            player: socket.id,
            velocity: [x_velocity, y_velocity],
            radius: 3,
            creationTime: new Date().getTime()
        }
    })


    socket.on("disconnect", (reason) => {
        console.log("player " + socket.id + " disconnected (" + reason + ")");
        delete players[socket.id];
        io.emit("deletePlayer", socket.id)
    })
});


function updateLoop() {
    setInterval(() => {
        calculatePositions();
        loopCollisions();
        io.emit("objectPositionUpdate", {
            backendPlayers: players,
            backendProjectiles: projectiles,
            backendEnemies: enemies,
        }) 
    }, 15)
    setInterval(() => {
        deleteObjects()
    }, 10000)

    spawnRandomEnemies()
    setInterval(() => {
        spawnRandomEnemies()
    }, 10000)
}

function calculatePositions() {
    for (const [id, projectile] of Object.entries(projectiles)) {
        projectile.position[0] += projectile.velocity[0];
        projectile.position[1] += projectile.velocity[1];
    }
    for (const [id, enemy] of Object.entries(enemies)) {
        enemy.position[0] += enemy.velocity[0];
        enemy.position[1] += enemy.velocity[1];
    }

    for (const [id, player] of Object.entries(players)) {
        player.velocity = math.add(player.velocity, player.acceleration);
        const velocity_scalar = math.norm(player.velocity) as number;
        const max_velocity = 20;
        if (velocity_scalar > max_velocity) {
                const unit_velocity = unitVector(player.velocity);
                player.velocity = math.multiply(unit_velocity, max_velocity) as Vector;
        }
        player.position = math.add(player.position, player.velocity);
        const dumping_coeficcient = -0.1;
        player.acceleration = math.multiply(player.velocity, dumping_coeficcient) as Vector;
    }
}

function deleteObjects() {
    for (const [id, projectile] of Object.entries(projectiles)) {
        if (projectile.creationTime && projectile.creationTime + 3000 < new Date().getTime()) delete projectiles[id]
    }
    for (const [id, enemy] of Object.entries(enemies)) {
        if (enemy.position[0] < mapBorders.x[0] || 
            enemy.position[0] > mapBorders.x[1] ||
            enemy.position[1] < mapBorders.y[0] ||
            enemy.position[1] > mapBorders.y[1]) {
            console.log(Date(), "deleting enemy (out of borders): ", enemy.position)
            delete enemies[id];
        }
    }
    
}

function spawnRandomEnemies() {
    if (Object.keys(enemies).length < 220) {
        for (let i = 0; i < 20; i += 1) {
            const {id: enemy_id, enemy} = createEnemy({});
            const min_player_enemy_spawn_distance = 500;
            for (const [player_id, player] of Object.entries(players)) {
                const distance = math.distance(player.position, enemy.position) as number
                if (distance > min_player_enemy_spawn_distance) {
                    enemies[enemy_id] = enemy
                }
            }
        }
    }
}

function createEnemy({position, radius, color, velocity} : {position?: Vector, radius?: number, color?: string, velocity?: Vector}) {
    const id = uuid.v4();
    const enemy_min = 100;
    const enemy_max = 300;
    const enemy = {
        position: position ? position : [math.random(mapBorders.x[1],  mapBorders.x[0]), math.random(mapBorders.y[1], mapBorders.y[0])] as Vector,
        color : color ? color : `hsl(${Math.random() * 360}, 80%, 50%)`,
        velocity: velocity ? velocity : [0, 0] as Vector,
        creationTime: new Date().getTime(),
        radius: radius ? radius : math.random(enemy_min, enemy_max),
    }
    return {id: id as string, enemy: enemy as Enemy}
    // enemies[id] = enemy
}


function loopCollisions() {
    for (const player of Object.values(players).reverse()) {
        for (const enemy of Object.values(enemies).reverse()) {
            const distance = Number(math.distance(player.position, enemy.position));
            if (distance < player.radius + enemy.radius) {
                collision_engine(player, enemy);
            }
        }
    }
    for (const enemy1 of Object.values(enemies).reverse())
        for (const enemy2 of Object.values(enemies).reverse()) {
            const distance = Number(math.distance(enemy1.position, enemy2.position));
            if (enemy1 !== enemy2) if (distance < enemy1.radius + enemy2.radius) {
                collision_engine(enemy1, enemy2);
            }
        }

    for (const projectile of Object.values(projectiles).reverse()) {
        for (const [id, enemy] of Object.entries(enemies).reverse()) {

            collision_engine(enemy, projectile);
            const distance = Number(math.distance(projectile.position, enemy.position));
            if (distance < projectile.radius + enemy.radius) {
                if (enemy.radius > 40) {
                    delete enemies[id];
                    let axis = [0, 0] as Vector;
                    if (enemy.velocity[0] && enemy.velocity[1]) axis = unitVector(enemy.velocity);
                    else axis = unitVector(projectile.velocity);
                    const new_radius = enemy.radius / (math.sqrt(2) as number);
                    const slide1 = rotateVector(axis, math.pi * 2/3);
                    const slide2 = rotateVector(axis, -math.pi * 2/3);
                    const pos1 = math.add(enemy.position, math.multiply(slide1, new_radius)) as Vector;
                    const pos2 = math.add(enemy.position, math.multiply(slide2, new_radius)) as Vector;
                    const {id: id1, enemy: enemy1} = createEnemy({position: pos1, radius: new_radius, color: enemy.color, velocity: enemy.velocity})
                    enemies[id1] = enemy1;
                    const {id: id2, enemy: enemy2} = createEnemy({position: pos2, radius: new_radius, color: enemy.color, velocity: enemy.velocity})
                    enemies[id2] = enemy2;
                    const player = players[projectile.player]
                    if (player) player.score += 1
                } else {
                    delete(enemies[id])
                }
            }
        }
    }
}

function collision_engine(obj1: CollisionObject, obj2: CollisionObject) {
    const distance = Number(math.distance(obj1.position, obj2.position));

    if (distance < obj1.radius + obj2.radius) {
        if (check_if_collide(obj1, obj2)) {
            elastic_collision(obj1, obj2);
        } else {
            push(obj1, obj2);
        }
    }
}

function push(obj1: CollisionObject, obj2: CollisionObject, accelerationCoefficient: number = 0.5) {
    if (obj1 === obj2) return
    const distance = math.distance(obj1.position, obj2.position) as number;
    const axis12 = math.divide(math.subtract(obj2.position, obj1.position), distance);
    const axis21 = math.multiply(axis12, -1);
    const center = math.add(obj2.position, math.multiply(axis21, obj1.radius + obj2.radius - distance));
    const push_coefficient = 1.04;
    const position1 = math.add(center, math.multiply(math.subtract(obj1.position, center), push_coefficient)) as Vector;
    const position2 = math.add(center, math.multiply(math.subtract(obj2.position, center), push_coefficient)) as Vector;
    obj1.position = position1;
    obj2.position = position2;
    // const delta_velocity1 = math.multiply(0.01 * Number(math.norm(obj1.velocity)), axis21) as Vector;
    // const delta_velocity2 = math.multiply(0.01 * Number(math.norm(obj2.velocity)), axis12) as Vector;
    const delta_velocity1 = math.multiply(accelerationCoefficient, axis21) as Vector;
    const delta_velocity2 = math.multiply(accelerationCoefficient, axis12) as Vector;
    obj1.velocity = math.add(obj1.velocity, delta_velocity1);
    obj2.velocity = math.add(obj2.velocity, delta_velocity2);
}

function elastic_collision(obj1: CollisionObject, obj2: CollisionObject) {
    const k1 = 2*obj2.radius/(obj1.radius + obj2.radius);
    const k2 = 2*obj1.radius/(obj1.radius + obj2.radius);

    let v1 = obj1.velocity;
    let v2 = obj2.velocity;
    let x1 = obj1.position;
    let x2 = obj2.position;

    let x12 = unitVector(math.subtract(x1, x2)) as Vector;
    x12 = math.multiply(math.dot(math.subtract(v1, v2), x12), x12) as Vector;
    let x21 = math.multiply(-1, x12);

    let v1new = math.subtract(v1, math.multiply(k1, x12)) as Vector;
    let v2new = math.subtract(v2, math.multiply(k2, x21)) as Vector;
    obj1.velocity = v1new;
    // obj1.velocity = math.multiply(2, v12);
    obj2.velocity = v2new;
    // obj1.collisionImmunityTime = new Date().getTime() + 200;
    // releaseParticles(obj1, obj2);

}




function check_if_collide(obj1: CollisionObject, obj2: CollisionObject) {
    const x12 = math.divide(math.subtract(obj2.position, obj1.position), math.distance(obj1.position, obj2.position)) as math.MathArray;

    const pr1 = math.multiply(math.multiply(obj1.velocity, x12), x12)
    const pr2 = math.multiply(math.multiply(obj2.velocity, x12), x12)

    if (math.dot(math.subtract(pr1, pr2) as Vector, x12) as number > 0) return true;
    return false;
}




function unitVector(vector: Vector) : Vector {
    return math.divide(vector, math.norm(vector)) as Vector
}

function rotateVector(vector: Vector, angle: number) {
    let rotationMatrix = [[math.cos(angle), -math.sin(angle)], [math.sin(angle), math.cos(angle)]]
    return math.multiply(rotationMatrix, vector)
}

updateLoop();

