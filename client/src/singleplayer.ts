import * as math from 'mathjs';

import {marks_on} from "./classes/classes"
import {GameEntity, Blob, Mark, TemporaryMark, MovingBlob, Player, Projectile, Enemy,Particle} from "./classes/classes"
import type {Vector, CollisionObject} from "./classes/classes"

const canvas = document.querySelector("canvas")!;
const con : any = canvas.getContext("2d");
let points = 0;
let velocity_reference = 1;


var  frame_number: number = 0;
const gameStateList = {
    play: "play",
    pause: "pause",
    end: "end"
}

let gameState = gameStateList.play;


const keyPress = {
    arrowLeft: {
        pressStartTime: 0,
        time: 0,
        state: false,
    },
    arrowRight: {
        pressStartTime: 0,
        time: 0,
        state: false,
    },
    arrowDown: {
        pressStartTime: 0,
        time: 0,
        state: false
    },
    arrowUp: {
        pressStartTime: 0,
        time: 0,
        state: false
    }
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

console.log(canvas.width);
console.log(canvas.height);

let projectiles : Projectile[] = [];
let enemies : Enemy[] = [];
let particles : Particle[] = [];
let marks : Mark[] = [];
let temporary_marks : TemporaryMark[] = [];
let players : Player[] = [];
let gameBlobs = [projectiles, enemies];
let gameObjects = [projectiles, particles, enemies];
let allObjects = [projectiles, enemies, particles, marks, temporary_marks];




function spawn_enemy() {
    const radius = 60 + Math.random() * 40;
    let enemy_x = 0 - radius;
    let enemy_y = 0 - radius;
    if (Math.random() > 0.5) {
        if (Math.random() > 0.5) enemy_y = canvas.height + radius;
        enemy_x = Math.random() * canvas.width
    } else {
        if (Math.random() > 0.5) enemy_x = canvas.width + radius
        enemy_y = Math.random() * canvas.height;
    }

    const enemy_pos = [enemy_x, enemy_y];
    const radius_pointer = math.subtract(player.pos, enemy_pos)
    const direction_vector = unitVector(radius_pointer)
    const velocity_scalar = 4 * velocity_reference;
    const velocity_vector = math.multiply(direction_vector, velocity_scalar) as Vector;
    const color = `hsl(${Math.random() * 360}, 50%, 50%)`
    const enemy = new Enemy(enemy_pos, radius, color, velocity_vector)
    enemies.push(enemy)
}


async function startGame() {
    const fps = 60;
    const intervalId = setInterval(() => {
        requestAnimationFrame(gameLogic)
    }, 1000/fps)

    async function gameLogic() {
        if (gameState == gameStateList.end) {
            projectiles.length = 0;
            enemies.length = 0;
            particles.length = 0;
            marks.length = 0;
            temporary_marks.length = 0;
            players.length = 0;
            console.log("all objects", allObjects)
            console.log("end")
            document.getElementById("menu")!.style.display = "flex";
            document.getElementById("scoreResult")!.innerText = String(points);
            clearInterval(intervalId);
            return;
        }
        
        if (gameState == gameStateList.pause) {
            await new Promise((resolve) => {
                window.addEventListener("keydown", (event) => {
                    if (event.code === "Enter") {
                        resolve(0);
                    }
                    if (event.code == "Space") {
                        gameState = gameStateList.play;
                        resolve(0);
                    }
                }, {once: true});
            });
            return;
        }
        if (frame_number % 120 == 0) {
            spawn_enemy();
        }

        frame_number+= 1;

        con.fillStyle = "rgba(0, 0, 0, 0.1)"
        con.fillRect(0, 0, canvas.width, canvas.height);

        clean_objects();
        update();
        loop_collisions();
    }
}


function clean_objects() {
    gameBlobs.forEach((group) => {
        for (let i = 0; i < group.length; i++) {
            const obj = group[i];
            if (Number(obj.pos[0]) - 2 * obj.radius > canvas.width || 
                Number(obj.pos[0]) + 2 * obj.radius < 0 || 
                Number(obj.pos[1]) - 2 * obj.radius > canvas.height ||
                Number(obj.pos[1]) + 2 * obj.radius < 0) {
                group.splice(i, 1);
            }
            if (obj.terminationTime < new Date().getTime()) {
                group.splice(i, 1);
            }
        }
    })
    allObjects.forEach((group) => {
        for (let i = group.length - 1; i >= 0; i--) {
            const obj = group[i];
            const terminationTime = obj.terminationTime;
            if (terminationTime) {
                if (terminationTime < new Date().getTime()) {
                    group.splice(i, 1);
                }
            }
        }

    })
    for (let i = 0; i < temporary_marks.length; i++) {
        temporary_marks.forEach((obj) => {
            if (obj.terminationTime < new Date().getTime()) {
                temporary_marks.splice(i, 1);
            }
        })
    }
}

function update() {
    player.draw();
    gameObjects.forEach((group) => {
        group.forEach((obj) => {
            obj.update();
        })
    })
    if (marks_on.state) {
        temporary_marks.forEach((obj) => {
            obj.update();
        })
    }
}

function loop_collisions() {
    enemies.forEach((enemy) => {
            const distance = Number(math.distance(player.pos, enemy.pos));
            if (distance < player.radius + enemy.radius) {
                gameState = gameStateList.end;
            }
    })

    for (let i = 0; i < enemies.length; i++) {
        for (let j = i + 1; j < enemies.length; j++) {
            const enemy1 = enemies[i];
            const enemy2 = enemies[j];

            const distance = Number(math.distance(enemy1.pos, enemy2.pos));
            if (distance < enemy1.radius + enemy2.radius) {
                collision_engine(enemy1, enemy2);
            }
        }
    }

    for (let i = 0; i < projectiles.length; i++) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            const projectile = projectiles[i];
            const enemy = enemies[j];
            const distance = Number(math.distance(projectile.pos, enemy.pos));
            if (distance < projectile.radius + enemy.radius) {
                if (enemy.radius > 40) {
                    enemies.splice(j, 1)
                    enemy.terminationTime = 0;
                    const axis = unitVector(enemy.velocity);
                    const new_radius = enemy.radius / (math.sqrt(2) as number);
                    console.log("enemy split: ", enemy.radius, enemy)
                    console.log(new Date(), new_radius);
                    console.log("enemies: ", enemies.length);
                    const slide1 = rotateVector(axis, math.pi * 2/3);
                    const slide2 = rotateVector(axis, -math.pi * 2/3);
                    const pos1 = math.add(enemy.pos, math.multiply(slide1, new_radius)) as Vector;
                    const pos2 = math.add(enemy.pos, math.multiply(slide2, new_radius)) as Vector;
                    const twin1 = new Enemy(pos1, new_radius, enemy.color, enemy.velocity);
                    const twin2 = new Enemy(pos2, new_radius, enemy.color, enemy.velocity);
                    points += 2;
                    updateScore();
                    enemies.push(twin1);
                    enemies.push(twin2);
                    releaseParticles(twin1, twin2);

                } else {
                    releaseParticles(projectile, enemy);
                    enemy.health -= 6;
                    if (enemy.health <= 0) {
                        enemies.splice(j, 1)
                        enemy.terminationTime = 0;
                        console.log("enemy deleted: ", enemy.radius)
                    }
                }

            }
        }
    }

}

function collision_engine(obj1: CollisionObject, obj2: CollisionObject) {
    const distance = Number(math.distance(obj1.pos, obj2.pos));

    if (distance < obj1.radius + obj2.radius) {
        if (check_if_collide(obj1, obj2)) {
            const now = new Date().getTime();
                elastic_collision(obj1, obj2);
        } else {
            push(obj1, obj2);
        }
    }
}

function push(obj1: CollisionObject, obj2: CollisionObject) {
    const distance = Number(math.distance(obj1.pos, obj2.pos));
    const axis12 = math.divide(math.subtract(obj2.pos, obj1.pos), distance);
    const axis21 = math.multiply(axis12, -1);
    // const center = math.add(obj2.pos, math.multiply(math.subtract(obj1.pos, obj2.pos), obj2.radius/(obj1.radius + obj2.radius)));
    const center = math.add(obj2.pos, math.multiply(axis21, obj1.radius + obj2.radius - distance));
    const push_coefficient = 5/4;
    const pos1 = math.add(center, math.multiply(math.subtract(obj1.pos, center), push_coefficient)) as Vector;
    const pos2 = math.add(center, math.multiply(math.subtract(obj2.pos, center), push_coefficient)) as Vector;
    obj1.pos = pos1;
    obj2.pos = pos2;
    const delta_velocity1 = math.multiply(0.01 * Number(math.norm(obj1.velocity)), axis21) as Vector;
    const delta_velocity2 = math.multiply(0.01 * Number(math.norm(obj2.velocity)), axis12) as Vector;
    obj1.velocity = math.add(obj1.velocity, delta_velocity1);
    obj2.velocity = math.add(obj2.velocity, delta_velocity2);
}

function elastic_collision(obj1: CollisionObject, obj2: CollisionObject) {
    const k1 = 2*obj2.radius/(obj1.radius + obj2.radius);
    const k2 = 2*obj1.radius/(obj1.radius + obj2.radius);

    let v1 = obj1.velocity;
    let v2 = obj2.velocity;
    let x1 = obj1.pos;
    let x2 = obj2.pos;

    let x12 = math.divide(math.subtract(x1, x2), math.distance(x1, x2)) as Vector;
    x12 = math.multiply(math.dot(math.subtract(v1, v2), x12), x12) as Vector;
    let x21 = math.multiply(-1, x12);

    let v1new = math.subtract(v1, math.multiply(k1, x12)) as Vector;
    let v2new = math.subtract(v2, math.multiply(k2, x21)) as Vector;
    obj1.velocity = v1new;
    // obj1.velocity = math.multiply(2, v12);
    obj2.velocity = v2new;
    // obj1.collisionImmunityTime = new Date().getTime() + 200;
    releaseParticles(obj1, obj2);
}


function releaseParticles(obj1: CollisionObject, obj2: CollisionObject) {
    const x12 = math.divide(math.subtract(obj2.pos, obj1.pos), math.distance(obj2.pos, obj1.pos)) as Vector;
    const center = math.add(obj1.pos, math.multiply(obj1.radius / (obj1.radius + obj2.radius), math.subtract(obj2.pos, obj1.pos))) as Vector;
    const pr1 = math.multiply(math.multiply(obj1.velocity, x12), x12) as Vector;
    const pr2 = math.multiply(math.multiply(obj2.velocity, x12), x12) as Vector;
    const normal_axis = rotateVector(x12, math.pi / 2);
    const scaling_factor = 50;
    const number_of_particles = (obj1.radius + obj2.radius) * Number(math.norm(math.subtract(pr1, pr2))) / scaling_factor;
    let direction = 1;
    for (let i = 0; i < number_of_particles; i++) {
        let particle_velocity = rotateVector(math.subtract(pr1, pr2), math.pi/2 + math.random() * 0.3);
        direction *= -1;
        const scaling_factor = math.random() * 2 + 1;
        particle_velocity = math.multiply(scaling_factor * direction, particle_velocity) as Vector;
        if (Number(math.norm(particle_velocity)) > 1) {
            let obj = (i % 4 == 0 || i % 4 == 3) ? obj1 : obj2;
            // if (!(obj instanceof Projectile)) {
                const particle = new Particle(center, 2, obj.color, particle_velocity);
                particles.push(particle);
            // }
        }
    }
}

function rotateVector(vector: Vector, angle: number) {
    let rotationMatrix = [[math.cos(angle), -math.sin(angle)], [math.sin(angle), math.cos(angle)]]
    return math.multiply(rotationMatrix, vector)
}

function unitVector(vector: Vector) : Vector {
    return math.divide(vector, math.norm(vector)) as Vector
}

function check_if_converge(obj1: CollisionObject, obj2: CollisionObject) {

    const unitVelocity1 = math.divide(obj1.velocity, math.norm(obj1.velocity)) as Vector;
    const unitVelocity2 = math.divide(obj2.velocity, math.norm(obj2.velocity)) as Vector;
    
    while (Number(math.distance(unitVelocity1, unitVelocity2)) < 0.00001) {
        const orthogonal = [obj2.velocity[1], -obj2.velocity[0]] as Vector;
        obj2.velocity = math.add(obj2.velocity, math.multiply(orthogonal, 0.01)) as Vector;
    }
    let a = math.transpose([obj1.velocity, math.multiply(obj2.velocity, -1) as Vector])
    let b = math.subtract(obj1.pos, obj2.pos)

    const intersection_variables = math.transpose(math.lusolve(a, b))[0] as Vector;
    let mark1;
    let mark2;
    if (marks_on.state) {
        const intersection = math.add(obj1.pos, math.multiply(intersection_variables[0], obj1.velocity)) as Vector;
        mark1 = new TemporaryMark(obj1.pos, math.subtract(intersection, obj1.pos), "green");
        mark2 = new TemporaryMark(obj2.pos, math.subtract(intersection, obj2.pos), "green");
        mark1.color = "green";
        mark2.color = "green";
    }

    if (Number(intersection_variables[0]) > 0 && Number(intersection_variables[1]) > 0) {
        if (marks_on.state) {
            if (mark1 && mark2) {
            mark1.color = "blue";
            mark2.color = "blue";
            temporary_marks.push(mark1);
            temporary_marks.push(mark2);
            }
        }
        return true;
    }
    else return false;
}

function check_if_collide(obj1: CollisionObject, obj2: CollisionObject) {
    const x12 = math.divide(math.subtract(obj2.pos, obj1.pos), math.distance(obj1.pos, obj2.pos)) as math.MathArray;

    const pr1 = math.multiply(math.multiply(obj1.velocity, x12), x12)
    const pr2 = math.multiply(math.multiply(obj2.velocity, x12), x12)

    if (marks_on.state) {
        const scaling_factor = 20;
        temporary_marks.push(new TemporaryMark(obj1.pos, math.multiply(scaling_factor, pr1) as Vector));
        temporary_marks.push(new TemporaryMark(obj2.pos, math.multiply(scaling_factor, pr2) as Vector));
    }

    if (math.dot(math.subtract(pr1, pr2) as Vector, x12) as number > 0) return true;
    return false;
}

window.addEventListener("mousedown", (event) => {
    let click_pos = [event.clientX, event.clientY];
    const radius_pointer = math.subtract(click_pos, player.pos);
    const direction_vector = unitVector(radius_pointer);
    const velocity_scalar = 4 * velocity_reference;
    const velocity_vector = math.multiply(direction_vector, velocity_scalar) as Vector;
    const projectile = new Projectile(player.pos, 5, "white", velocity_vector, 10);

    projectiles.push(projectile);
})

window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
        if (gameState == gameStateList.play) {
            gameState = gameStateList.pause;
        } else if (gameState == gameStateList.pause) {
            gameState = gameStateList.play;
        }
    }
    if (event.code === "ArrowDown") {
        if (keyPress.arrowDown.state == false) {
            keyPress.arrowDown.state = true;
            keyPress.arrowDown.pressStartTime = new Date().getTime();
        }
    }
    if (event.code === "ArrowUp") {
        if (keyPress.arrowUp.state == false) {
            keyPress.arrowUp.state = true;
            keyPress.arrowDown.pressStartTime = new Date().getTime();
        }
    }
    if (event.code === "ArrowLeft") {
        if (keyPress.arrowLeft.state == false) {
            keyPress.arrowLeft.state = true;
            keyPress.arrowDown.pressStartTime = new Date().getTime();
        }
    }
    if (event.code === "ArrowRight") {
        if (keyPress.arrowRight.state == false) {
            keyPress.arrowRight.state = true;
            keyPress.arrowDown.pressStartTime = new Date().getTime();
        }
    }
})

window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowDown") {
        if (keyPress.arrowDown.state == true) {
            keyPress.arrowDown.state = false;
            keyPress.arrowDown.time = new Date().getTime() - keyPress.arrowDown.pressStartTime;
            console.log(keyPress.arrowDown.time)
        }
    }
    if (event.code === "ArrowUp") {
        if (keyPress.arrowUp.state == false) {
            keyPress.arrowUp.state = true;
            keyPress.arrowDown.time = new Date().getTime() - keyPress.arrowDown.pressStartTime;
        }
    }
    if (event.code === "ArrowLeft") {
        if (keyPress.arrowLeft.state == false) {
            keyPress.arrowLeft.state = true;
            keyPress.arrowDown.time = new Date().getTime() - keyPress.arrowDown.pressStartTime;
        }
    }
    if (event.code === "ArrowRigth") {
        if (keyPress.arrowRight.state == false) {
            keyPress.arrowRight.state = true;
            keyPress.arrowDown.time = new Date().getTime() - keyPress.arrowDown.pressStartTime;
        }
    }
})



const scoreElement = document.getElementById("score")!
function updateScore() {
    scoreElement.innerText = "Score: " + points;
}

document.getElementById("restartButton")!.addEventListener("click", () => {
    gameState = gameStateList.play;
    document.getElementById("menu")!.style.display = "none";
    document.getElementById("score")!.innerText = "Score: 0";
    points = 0;
    console.log("starting game")
    console.log("all objects", allObjects)
    startGame();
})

document.getElementById("showMarksButton")!.addEventListener("click", () => {
    if (marks_on.state == true) marks_on.state = false
    else {
        marks_on.state = true;
        enemies.forEach( (enemy) => {
            console.log("enemy: ", enemy);
            if (marks_on.state) {
                const scaling_factor = 60;
                enemy.mark = new Mark(enemy.pos, math.multiply(enemy.velocity, scaling_factor) as Vector);
            }
        })
    }
    console.log(marks_on.state)
})

window.addEventListener("resize", () => {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
})

const player = new Player([canvas.width / 2, canvas.height / 2], 15, "white");
players.push(player);


startGame()
