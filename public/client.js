const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

canvas.width = window.innerWidth
canvas.height = window.innerHeight

const ws = new WebSocket(location.origin.replace("http","ws"))

let state = {players:{},food:[],viruses:[]}
let myId = null

document.getElementById("play").onclick=()=>{

ws.send(JSON.stringify({
type:"join",
name:document.getElementById("nick").value
}))

document.getElementById("menu").style.display="none"

}

ws.onmessage=e=>{

let data = JSON.parse(e.data)

if(data.type==="init"){
myId=data.id
return
}

state=data

}

canvas.onmousemove=e=>{

ws.send(JSON.stringify({
type:"move",
x:e.clientX,
y:e.clientY
}))

}

window.onkeydown=e=>{

if(e.code==="Space")
ws.send(JSON.stringify({type:"split"}))

if(e.code==="KeyW")
ws.send(JSON.stringify({type:"eject"}))

}

function draw(){

ctx.fillStyle="#111"
ctx.fillRect(0,0,canvas.width,canvas.height)

state.food.forEach(f=>{
ctx.fillStyle=f.color
ctx.beginPath()
ctx.arc(f.x,f.y,4,0,Math.PI*2)
ctx.fill()
})

Object.values(state.players).forEach(p=>{

p.cells.forEach(c=>{

ctx.fillStyle=p.color

let r=Math.sqrt(c.mass*100/Math.PI)

ctx.beginPath()
ctx.arc(c.x,c.y,r,0,Math.PI*2)
ctx.fill()

})

})

requestAnimationFrame(draw)

}

draw()
