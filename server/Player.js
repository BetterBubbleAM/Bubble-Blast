const Cell=require("./Cell")

class Player{

constructor(server,ws){

this.server=server
this.ws=ws

this.id=Math.random().toString(36)

this.cells=[]

this.mouseX=0
this.mouseY=0

this.name="player"
this.clan=""
this.skin=""

this.party=null

this.spawn()

}

spawn(){

this.cells=[]

this.cells.push(

new Cell(

this.server,
this,

Math.random()*this.server.mapSize,
Math.random()*this.server.mapSize,

20

)

)

}

handleMessage(msg){

let data

try{
data=JSON.parse(msg)
}catch{return}

if(data.type==="join"){

this.name=data.name||"player"
this.skin=data.skin||""
this.clan=data.clan||""

}

if(data.type==="move"){

this.mouseX=data.x
this.mouseY=data.y

}

if(data.type==="split"){

this.split()

}

if(data.type==="eject"){

this.eject()

}

if(data.type==="party"){

this.server.joinParty(this,data.code)

}

}

split(){

if(this.cells.length>=16)return

let newCells=[]

this.cells.forEach(cell=>{

if(cell.mass<36)return

cell.mass/=2

let angle=Math.atan2(

this.mouseY-cell.y,
this.mouseX-cell.x

)

let newCell=new Cell(

this.server,
this,

cell.x,
cell.y,

cell.mass

)

newCell.vx=Math.cos(angle)*80
newCell.vy=Math.sin(angle)*80

newCell.mergeTime=300

cell.mergeTime=300

newCells.push(newCell)

})

this.cells.push(...newCells)

}

eject(){

this.cells.forEach(cell=>{

if(cell.mass<35)return

cell.mass-=15

let angle=Math.atan2(

this.mouseY-cell.y,
this.mouseX-cell.x

)

this.server.ejected.push({

x:cell.x,
y:cell.y,

vx:Math.cos(angle)*80,
vy:Math.sin(angle)*80,

mass:12

})

})

}

update(){

this.cells.forEach(c=>c.update())

}

}

module.exports=Player
