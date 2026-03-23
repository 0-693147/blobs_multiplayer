import * as math from 'mathjs';

import {marks_on} from "./classes/classes"
import {GameEntity, Blob, Mark, TemporaryMark, MovingBlob, Player, Projectile, Enemy,Particle} from "./classes/classes"
import type {Vector, CollisionObject} from "./classes/classes"

import { io } from "socket.io-client"



const socket = io();
socket.on("connect", () => {
    console.log("connnected")
    console.log("socket id: ", socket.id)
    players = {};
})


const canvas = document.querySelector("canvas")!;
const coordinateElement = document.getElementById("coordinates")!;
const con : any = canvas.getContext("2d");
let points = 0;
let velocity_reference = 1;
let trailLength = 5;
let checkIfObjectsExist = false;


var  frame_number: number = 0;
const gameStateList = {
    play: "play",
    pause: "pause",
    end: "end"
}

let gameState = gameStateList.play;


const keyPress = {
    "arrowLeft": {
        pressStartTime: 0,
        time: 0,
        state: false,
    },
    "arrowRight": {
        pressStartTime: 0,
        time: 0,
        state: false,
    },
    "arrowDown": {
        pressStartTime: 0,
        time: 0,
        state: false
    },
    "arrowUp": {
        pressStartTime: 0,
        time: 0,
        state: false
    }
}
let sendProjectile : {
    angle: number | null;
} | null = null ;


canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let projectiles : { [id : string]: Projectile } = {}; 
let enemies : { [id : string] : Enemy } = {}
let particles : Particle[] = [];
let marks : Mark[] = [];
let temporary_marks : TemporaryMark[] = [];
let players : { [id : string]: Player } = {};
let gameBlobs = [projectiles, enemies];
let gameObjects = [projectiles, particles, enemies];
let allObjects = [projectiles, enemies, particles, marks, temporary_marks];
let recencyList = [];

type backendPlayerType = {
    position: [number, number];
    color: string;
}


let thisPlayer : Player;
let thisPlayerPosition : Vector = [0, 0];

socket.on("playerInitialization", (thisPlayerBackend) => {createPlayer(thisPlayerBackend)})

socket.on("objectPositionUpdate", (objects) => {
    const backendPlayers : { [id : string]: backendPlayerType} = objects.backendPlayers;
    const backendProjectiles : { [id : string]: {position: Vector, color: string, velocity: Vector} } = objects.backendProjectiles;
    const backendEnemies : { [id : string]: {
        position: Vector,
        color: string,
        velocity: Vector,
        radius: number,
        creationTime?: number,
    }} = objects.backendEnemies;

    if (socket.id) {
        thisPlayerPosition = backendPlayers[socket.id].position;
        coordinateElement.textContent = String(math.round(thisPlayerPosition[0])) + " " + String(math.round(thisPlayerPosition[1]))
    }
    for (const [id, player] of Object.entries(players)) {
        if (!backendPlayers[id]) {
            delete players[id]
            console.log("deleting inactive player: " + socket.id)
        }
    }

    for (const [id, backendPlayer] of Object.entries(backendPlayers)) {
        const { position, color } = backendPlayer;
        if (!players[id]) players[id] = new Player({position: position, radius: 15, color: color});
        const player = players[id];

        player.pos = position;
        if (player.trail[0][0] != position[0] || player.trail[0][1] != position[1]) {
            player.trail.unshift(position);
        } else {
            if (player.trail.length > 1) {
                player.trail.pop();
            }
        }

        if (player.trail.length > trailLength) {
            player.trail = player.trail.slice(0, trailLength + 1)
        }
    }

    for (const [id, projectile] of Object.entries(backendProjectiles)) {
        const {position, color, velocity} = projectile;
        if (!projectiles[id]) {
            projectiles[id] = new Projectile({color: color, velocity: velocity, pos: position, radius: 3});
        }
        projectiles[id].pos = position;
    }

    for (const [id, projectile] of Object.entries(projectiles)) {
        if (!backendProjectiles[id]) {
            delete projectiles[id]
        }
    }

    for (const [id, enemy] of Object.entries(backendEnemies)) {
        const {position, color, velocity, radius} = enemy;

        if (!enemies[id]) {
            console.log(backendEnemies)
            enemies[id] = new Enemy({color: color, velocity: velocity, pos: position, radius: radius});
            
        }
        enemies[id].pos = position;
    }

    for (const [id, enemy] of Object.entries(enemies)) {
        if (!backendEnemies[id]) {
            delete enemies[id]
        }
    }

})

socket.on("deletePlayer", (playerID: string) => { 
    delete players[playerID];
})


function createPlayer(thisPlayerBackend: backendPlayerType) {
    if (socket.id) {
    const { position, color } = thisPlayerBackend;
    thisPlayerPosition = position;
    thisPlayer = new Player({position: position, radius: 15, color: color});
    const id : string = socket.id;
    players[socket.id] = thisPlayer;
    }
}


function gameLoop() {
    const fps = 60;
    setInterval(() => {
        socket.emit("playerMoves", keyPress)
        if (sendProjectile) {
            socket.emit("playerSendsProjectile", sendProjectile)
            sendProjectile = null;
        }
        requestAnimationFrame(() => {
            drawObjects();
        })
    }, 1000/fps)
    setInterval(() => {checkIfObjectsExist = true}, 5000)

    function drawObjects() {
        frame_number+= 1;
        con.fillStyle = "rgba(0, 0, 0, 1)"
        con.fillRect(0, 0, canvas.width, canvas.height);


        for (const [id, player] of Object.entries(players)) {
            let {h, s, l}= colorToNumber(player.color)
            let a = 1;
            a *= 0.6 ** (trailLength - 1)

            player.trail.reverse().forEach((position) => {
                const newcolor = numberToColor({h: h, s: s, l: l, a: a})
                drawBlob(position, player.radius, newcolor);
            })
            drawBlob(player.pos, player.radius, player.color);
        }

        for (const [id, projectile] of Object.entries(projectiles)) {
            drawBlob(projectile.pos, projectile.radius, projectile.color)
        }

        for (const [id, enemy] of Object.entries(enemies)) {
            drawBlob(enemy.pos, enemy.radius, enemy.color)
        }

    }
}


function coordinatesGlobalToLocal({playerPosition, globalPosition} : {playerPosition: Vector, globalPosition: Vector}) {
    const localPosition : Vector = [
        canvas.width/2 - playerPosition[0] + globalPosition[0],
        canvas.height/2 + playerPosition[1] - globalPosition[1]
        ]
    return localPosition;
}

function coordinatesLocalToGlobal({playerPosition, localPosition} : {playerPosition: Vector, localPosition: Vector}) {
    const globalPosition: Vector = [
        -canvas.width/2 + playerPosition[0] + localPosition[0],
        canvas.height/2 + playerPosition[1] - localPosition[1]
        ]
    return globalPosition;
}

function colorToNumber(colorString: string) {
    let threevalues = colorString.slice(5, -1).split(",")
    threevalues = threevalues.map((element) => element.trim())
    threevalues = threevalues.map((element) => (element.slice(-1) === "%") ? element.slice(0, -1) : element)
    const threenumbers = threevalues.map((element) => Number(element))
    return {h: threenumbers[0], s: threenumbers[1], l: threenumbers[2]}
}

function numberToColor({h, s, l, a} : {h: number, s: number, l: number, a?: number}) {
    if (!a) {
        return `hsl(${h}, ${s}%, ${l}%)`
    } else {
        return `hsla(${h}, ${s}%, ${l}%, ${a}%)`
    }
}

function drawBlob(position: [number, number], radius: number, color: string) {
    const relativePosition = [
        canvas.width/2 - thisPlayerPosition[0] + position[0],
        canvas.height/2 + thisPlayerPosition[1] - position[1]
    ]
    con.beginPath();
    con.arc(relativePosition[0], relativePosition[1], radius, 0, Math.PI*2, true);
    con.fillStyle = color;
    con.fill();
}



window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
        if (gameState == gameStateList.play) {
            gameState = gameStateList.pause;
        } else if (gameState == gameStateList.pause) {
            gameState = gameStateList.play;
        }
    }
    switch(event.code) {
        case "ArrowDown":
        case "KeyS":
            keyPress["arrowDown"].state = true;
            break;
        case "ArrowUp":
        case "KeyW":
            keyPress["arrowUp"].state = true;
            break;
        case "ArrowLeft":
        case "KeyA":
            keyPress["arrowLeft"].state = true;
            break;
        case "ArrowRight":
        case "KeyD":
            keyPress["arrowRight"].state = true;
            break;
    }
})

window.addEventListener("keyup", (event) => {
    console.log(event.code)
    switch(event.code) {
        case "ArrowDown":
        case "KeyS":
            keyPress["arrowDown"].state = false;
            break;
        case "ArrowUp":
        case "KeyW":
            keyPress["arrowUp"].state = false;
            break;
        case "ArrowLeft":
        case "KeyA":
            keyPress["arrowLeft"].state = false;
            break;
        case "ArrowRight":
        case "KeyD":
            keyPress["arrowRight"].state = false;
            break;
    }
})


window.addEventListener("click", (event) => {
    const x = event.x - canvas.width/2
    const y = -(event.y - canvas.height/2)
    console.log(event.x)
    console.log(event.y)
    const angle = math.atan2(y, x)
    console.log(angle)
    sendProjectile = {angle: angle}
})



const scoreElement = document.getElementById("score")!
function updateScore() {
    scoreElement.innerText = "Score: " + points;
}

window.addEventListener("resize", () => {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
})

console.log("end")
gameLoop();
