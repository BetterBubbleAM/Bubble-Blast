const EAT_RATIO = 1.25
const DECAY_RATE = 0.002

function radius(m){
return Math.sqrt(m*100/Math.PI)
}

function distance(a,b){

let dx = a.x-b.x
let dy = a.y-b.y

return Math.sqrt(dx*dx+dy*dy)

}

function canEat(a,b){

if(a.mass < b.mass*EAT_RATIO) return false

let r1 = radius(a.mass)
let r2 = radius(b.mass)

let dist = distance(a,b)

return dist < r1-r2

}

function massDecay(cell){

if(cell.mass < 500) return

cell.mass -= cell.mass * DECAY_RATE / 30

}

module.exports = {

radius,
distance,
canEat,
massDecay

}
