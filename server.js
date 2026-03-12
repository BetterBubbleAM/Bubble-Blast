const express = require("express")
const http = require("http")
const WebSocket = require("ws")
const path = require("path")

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

app.use(express.static(path.join(__dirname,"public")))

app.get("/",(req,res)=>{
res.sendFile(path.join(__dirname,"public","index.html"))
})

const MAP_SIZE = 4000
const TICK = 30

const START_MASS = 20
const EAT_RATIO = 1.25
const DECAY = 0.002

let players = {}
let food = []
let viruses = []
let ejected = []

function radius(m){
return Math.sqrt(m*100/Math.PI)
}

function rand(){
return Math.random()*MAP_SIZE
}

function spawnFood(){

food.push({
x:rand(),
y:rand(),
mass:1,
color:`hsl(${Math.random()*360},70%,60%)`
})

}

function spawnVirus(){

viruses.push({
x:rand(),
y:rand(),
mass:100,
fed:0,
vx:0,
vy:0
})

}

for(let i=0;i<800;i++) spawnFood()
for(let i=0;i<25;i++) spawnVirus()

wss.on("connection",ws=>{

let id = Math.random().toString(36)

ws.send(JSON.stringify({type:"init",id}))

ws.on("message",msg=>{

let data = JSON.parse(msg)

if(data.type==="join"){

players[id]={
id,
name:data.name,
color:`hsl(${Math.random()*360},70%,60%)`,
mouseX:2000,
mouseY:2000,
cells:[{
x:rand(),
y:rand(),
mass:START_MASS,
vx:0,
vy:0
}]
}

}

let p = players[id]
if(!p) return

if(data.type==="move"){
p.mouseX=data.x
p.mouseY=data.y
}

if(data.type==="split"){

if(p.cells.length>=16) return

let newCells=[]

p.cells.forEach(cell=>{

if(cell.mass<36) return

cell.mass/=2

let angle=Math.atan2(p.mouseY-cell.y,p.mouseX-cell.x)

newCells.push({
x:cell.x,
y:cell.y,
mass:cell.mass,
vx:Math.cos(angle)*70,
vy:Math.sin(angle)*70
})

})

p.cells.push(...newCells)

}

if(data.type==="eject"){

p.cells.forEach(cell=>{

if(cell.mass<35) return

cell.mass-=15

let angle=Math.atan2(p.mouseY-cell.y,p.mouseX-cell.x)

ejected.push({
x:cell.x,
y:cell.y,
mass:12,
vx:Math.cos(angle)*80,
vy:Math.sin(angle)*80,
color:p.color
})

})

}

})

ws.on("close",()=>delete players[id])

})

setInterval(()=>{

// physics eject

ejected.forEach(m=>{
m.x+=m.vx
m.y+=m.vy
m.vx*=0.9
m.vy*=0.9
})

// virus movement

viruses.forEach(v=>{
v.x+=v.vx
v.y+=v.vy
v.vx*=0.95
v.vy*=0.95
})

// players

Object.values(players).forEach(p=>{

p.cells.forEach(cell=>{

let speed=2.2*Math.pow(cell.mass,-0.44)*20

let angle=Math.atan2(p.mouseY-cell.y,p.mouseX-cell.x)

cell.x+=Math.cos(angle)*speed+cell.vx
cell.y+=Math.sin(angle)*speed+cell.vy

cell.vx*=0.85
cell.vy*=0.85

// decay

if(cell.mass>500){

cell.mass -= cell.mass*DECAY/TICK

}

let r = radius(cell.mass)

// eat food

food.forEach((f,i)=>{

if(Math.hypot(cell.x-f.x,cell.y-f.y)<r){

cell.mass+=1
food.splice(i,1)
spawnFood()

}

})

})

})

// player eat

let ids=Object.keys(players)

ids.forEach(a=>{

ids.forEach(b=>{

if(a===b) return

let p1=players[a]
let p2=players[b]

p1.cells.forEach(c1=>{

p2.cells.forEach((c2,i)=>{

let dist=Math.hypot(c1.x-c2.x,c1.y-c2.y)

let r1=radius(c1.mass)
let r2=radius(c2.mass)

if(dist<r1-r2){

if(c1.mass>c2.mass*EAT_RATIO){

c1.mass+=c2.mass
p2.cells.splice(i,1)

}

}

})

})

})

})

// virus feed

ejected.forEach((m,i)=>{

viruses.forEach(v=>{

if(Math.hypot(m.x-v.x,m.y-v.y)<radius(v.mass)){

v.fed++

if(v.fed>=7){

v.fed=0

spawnVirus()

}

ejected.splice(i,1)

}

})

})

let leaderboard = Object.values(players)
.map(p=>({
name:p.name,
mass:p.cells.reduce((a,b)=>a+b.mass,0)
}))
.sort((a,b)=>b.mass-a.mass)
.slice(0,10)

let state = JSON.stringify({
players,
food,
viruses,
ejected,
leaderboard
})

wss.clients.forEach(c=>{
if(c.readyState===WebSocket.OPEN)
c.send(state)
})

},1000/TICK)

const PORT = process.env.PORT || 10000

server.listen(PORT,()=>console.log("Bubble Engine Running"))
