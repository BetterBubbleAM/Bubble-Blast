const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

const minimap = document.getElementById("minimap")
const mctx = minimap.getContext("2d")

canvas.width = window.innerWidth
canvas.height = window.innerHeight

const ws = new WebSocket(location.origin.replace("http","ws"))

let state={players:{},food:[],viruses:[],leaderboard:[]}

let myId=null

const skins={}

let cameraX=0
let cameraY=0
let zoom=1

const mapSize=4000

let macroFeed=false

// MENU

document.getElementById("play").onclick=()=>{

ws.send(JSON.stringify({

type:"join",

name:document.getElementById("nick").value,

skin:document.getElementById("skin").value,

clan:document.getElementById("clan").value

}))

document.getElementById("menu").style.display="none"

}

// PARTY

document.getElementById("createParty").onclick=()=>{

ws.send(JSON.stringify({type:"createParty"}))

}

document.getElementById("joinParty").onclick=()=>{

ws.send(JSON.stringify({

type:"party",

code:document.getElementById("partyCode").value

}))

}

// SOCKET

ws.onmessage=e=>{

let data=JSON.parse(e.data)

if(data.type==="init"){
myId=data.id
return
}

state=data

}

// CONTROLS

canvas.onmousemove=e=>{

ws.send(JSON.stringify({

type:"move",

x:(e.clientX/zoom)+cameraX,
y:(e.clientY/zoom)+cameraY

}))

}

window.onkeydown=e=>{

if(e.code==="Space")
ws.send(JSON.stringify({type:"split"}))

if(e.code==="KeyW")
ws.send(JSON.stringify({type:"eject"}))

// DOUBLE SPLIT

if(e.code==="KeyQ"){

ws.send(JSON.stringify({type:"split"}))
setTimeout(()=>ws.send(JSON.stringify({type:"split"})),40)

}

// LINE SPLIT

if(e.code==="KeyE"){

for(let i=0;i<4;i++)
setTimeout(()=>ws.send(JSON.stringify({type:"split"})),i*30)

}

// MACRO FEED

if(e.code==="KeyR") macroFeed=true

}

window.onkeyup=e=>{

if(e.code==="KeyR") macroFeed=false

}

setInterval(()=>{

if(macroFeed)
ws.send(JSON.stringify({type:"eject"}))

},40)

// CAMERA

function updateCamera(){

let me=state.players[myId]

if(!me) return

let avgX=0
let avgY=0
let mass=0

me.cells.forEach(c=>{

avgX+=c.x
avgY+=c.y
mass+=c.mass

})

avgX/=me.cells.length
avgY/=me.cells.length

cameraX+=((avgX-canvas.width/2/zoom)-cameraX)*0.1
cameraY+=((avgY-canvas.height/2/zoom)-cameraY)*0.1

let targetZoom=Math.max(0.2,1-Math.log(mass)/10)

zoom+=(targetZoom-zoom)*0.1

}

// CELL DRAW

function drawCell(cell,player){

let r=Math.sqrt(cell.mass*100/Math.PI)

ctx.beginPath()

ctx.arc(
(cell.x-cameraX)*zoom,
(cell.y-cameraY)*zoom,
r*zoom,
0,
Math.PI*2
)

if(player.skin){

let img=skins[player.skin]

if(!img){

img=new Image()
img.src=player.skin
skins[player.skin]=img

}

ctx.save()
ctx.clip()

ctx.drawImage(

img,

(cell.x-r-cameraX)*zoom,
(cell.y-r-cameraY)*zoom,

r*2*zoom,
r*2*zoom

)

ctx.restore()

}else{

ctx.fillStyle="#5bc0de"
ctx.fill()

}

ctx.strokeStyle="#000"
ctx.stroke()

// NICK + CLAN

ctx.fillStyle="white"
ctx.textAlign="center"
ctx.font=(r*zoom/2)+"px Arial"

let name = player.clan ? "["+player.clan+"] "+player.name : player.name

ctx.fillText(

name,

(cell.x-cameraX)*zoom,

(cell.y-cameraY)*zoom

)

// TEAM INDICATOR

let me = state.players[myId]

if(me && player.party && me.party && player.party===me.party){

ctx.strokeStyle="yellow"
ctx.lineWidth=3

ctx.beginPath()

ctx.arc(
(cell.x-cameraX)*zoom,
(cell.y-cameraY)*zoom,
(r+5)*zoom,
0,
Math.PI*2
)

ctx.stroke()

ctx.lineWidth=1

}

}

// FOOD

function drawFood(){

state.food.forEach(f=>{

ctx.fillStyle=f.color || "#00ff00"

ctx.beginPath()

ctx.arc(

(f.x-cameraX)*zoom,
(f.y-cameraY)*zoom,

4*zoom,

0,
Math.PI*2

)

ctx.fill()

})

}

// VIRUSES

function drawViruses(){

state.viruses.forEach(v=>{

ctx.fillStyle="#33ff33"

ctx.beginPath()

ctx.arc(
(v.x-cameraX)*zoom,
(v.y-cameraY)*zoom,
40*zoom,
0,
Math.PI*2
)

ctx.fill()

})

}

// PLAYERS

function drawPlayers(){

Object.values(state.players).forEach(p=>{

p.cells.forEach(c=>{

drawCell(c,p)

})

})

}

// LEADERBOARD

function drawLeaderboard(){

let html="Leaderboard<br>"

state.leaderboard.forEach((p,i)=>{

html+=(i+1)+". "+p.name+"<br>"

})

document.getElementById("leaderboard").innerHTML=html

}

// MINIMAP

function drawMinimap(){

mctx.clearRect(0,0,200,200)

mctx.strokeStyle="#333"

for(let i=0;i<10;i++){

mctx.beginPath()
mctx.moveTo(i*20,0)
mctx.lineTo(i*20,200)
mctx.stroke()

mctx.beginPath()
mctx.moveTo(0,i*20)
mctx.lineTo(200,i*20)
mctx.stroke()

}

Object.values(state.players).forEach(p=>{

p.cells.forEach(c=>{

let x=c.x/mapSize*200
let y=c.y/mapSize*200

let me = state.players[myId]

if(me && p.party && me.party && p.party===me.party)
mctx.fillStyle="yellow"
else
mctx.fillStyle="red"

mctx.fillRect(x,y,4,4)

})

})

}

// GAME LOOP

function draw(){

ctx.fillStyle="#111"
ctx.fillRect(0,0,canvas.width,canvas.height)

updateCamera()

drawFood()

drawViruses()

drawPlayers()

drawLeaderboard()

drawMinimap()

requestAnimationFrame(draw)

}

draw()
