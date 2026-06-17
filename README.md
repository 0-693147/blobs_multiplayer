# Simple Web Multiplayer Game

<img width="1916" height="932" alt="Game Mechanics" src="https://github.com/user-attachments/assets/8edebc12-0380-4ac9-8194-858c6e9ccb3a" />

### User Guide:
1. Move using arrows or the AWSD keys
2. Shoot projectiles using the left mouse click. They destroy the blobs. Every destroyed blob gives you score points, which are displayed on the leaderboard. 
3. Dash using the right click. The dash has a 2 second cooldown. Player blips momentarily when the dash is ready. The dash grants you a small window of invinsibility, which you can see as a black hollow inside the player. The bigger the hollow, the less damage you receive.
4. You receive damange when you collide with a blob or a player. The higher the speed, the more damage you receive.
5. To kill other players, dash into them. The projectiles don't harm ohter players, so dashing is the only option. The other idea would be to dash into small blobs, which in turn will kill players due to their high speed.

## Starting the Server
The server usess HTTPS, so before serving you should create the certificates with the following commands (on Linux):
```
openssl genrsa -out self_signed_key.pem 2048
openssl req -new -x509 -key self_signed_key.pem -out self_signed_cert.pem -days 365 -nodes
```
After creating the certificates, create the server/certificate/ directory and put the generated files there.

To start the server, issue
```
npx nodemon src/server.ts
```
from the server directory.

## About the project

The client is written in TypeScript, basic CSS, HTML, bundled by Vite. 

The server is written in TypeScript. Introduced a simple collision engine (fortunately, every object is a circle), created multiplayer capabilities with websockets. The client-server architecture is fully authoritative. The frames are calculated every 15 ms with packets sent every 15 ms as well. The physics is based on the idea of elastic collisions, mimicking the real world physics of conservative systems.  
