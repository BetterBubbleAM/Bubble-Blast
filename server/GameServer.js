const Player = require("./Player")
const Food = require("./Food")
const Virus = require("./Virus")
const physics = require("./physics")

const TICKRATE = 30

class GameServer{

constructor(){

this.players = new Map()

this.food = []
this.viruses = []
this.ejected = []

this.mapSize = 4000

this.foodAmount = 1200
this.virusAmount = 35

// PARTY SYSTEM
this.parties = new Map()

}

start(){

for(let i=0;i<this.foodAmount;i++)
this.food.push(new Food(this))

for(let i=0;i<this.virusAmount;i++)
this.viruses.push(new Virus(this))

setInterval(()=>{

this.update()

},1000/TICKRATE)

}

addClient(ws){

let player = new Player(this,ws)

this.players.set(player.id,player)

ws.send(JSON.stringify({
type:"init",
id:player.id
}))

ws.on("message",(msg)=>{

player.handleMessage(msg)

})

ws.on("close",()=>{

this.removePlayerFromParty(player)

this.players.delete(player.id)

})

}

/////////////////////////////
// PARTY SYSTEM
/////////////////////////////

createParty(){

let code = Math.random().toString(36).substring(2,7)

this.parties.set(code,[])

return code

}

joinParty(player,code){

if(!this.parties.has(code)){

this.parties.set(code,[])

}

player.party = code

this.parties.get(code).push(player)

}

removePlayerFromParty(player){

if(!player.party) return

let list = this.parties.get(player.party)

if(!list) return

let index = list.indexOf(player)

if(index !== -1){

list.splice(index,1)

}

if(list.length === 0){

this.parties.delete(player.party)

}

}

/////////////////////////////

update(){

this.players.forEach(p=>p.update())

this.updateEjected()

this.updateViruses()

this.updateFood()

this.updateCollisions()

this.sendWorldState()

}

updateFood(){

while(this.food.length < this.foodAmount){

this.food.push(new Food(this))

}

}

updateViruses(){

this.viruses.forEach(v=>v.update())

}

updateEjected(){

for(let i=this.ejected.length-1;i>=0;i--){

let m=this.ejected[i]

m.x += m.vx
m.y += m.vy

m.vx *= 0.9
m.vy *= 0.9

}

}

updateCollisions(){

let players=[...this.players.values()]

for(let p1 of players){

for(let c1 of p1.cells){

// FOOD

for(let i=this.food.length-1;i>=0;i--){

let f=this.food[i]

let dx=c1.x-f.x
let dy=c1.y-f.y

if(Math.sqrt(dx*dx+dy*dy) < physics.radius(c1.mass)){

c1.mass+=1

this.food.splice(i,1)

}

}

// PLAYER EAT

for(let p2 of players){

if(p1===p2) continue

for(let i=p2.cells.length-1;i>=0;i--){

let c2=p2.cells[i]

if(physics.canEat(c1,c2)){

c1.mass += c2.mass

p2.cells.splice(i,1)

}

}

}

}

}

}

getLeaderboard(){

return [...this.players.values()]
.map(p=>({

name:p.name,
party:p.party || "",
mass:p.cells.reduce((a,c)=>a+c.mass,0)

}))
.sort((a,b)=>b.mass-a.mass)
.slice(0,10)

}

sendWorldState(){

let state={

players:{},
food:this.food,
viruses:this.viruses,
ejected:this.ejected,
leaderboard:this.getLeaderboard(),
parties:[...this.parties.keys()]

}

this.players.forEach(p=>{

state.players[p.id]={

name:p.name,
party:p.party || "",

cells:p.cells.map(c=>({

x:c.x,
y:c.y,
mass:c.mass

}))

}

})

let packet = JSON.stringify(state)

this.players.forEach(p=>{

if(p.ws.readyState===1)
p.ws.send(packet)

})

}

}

module.exports = GameServer
