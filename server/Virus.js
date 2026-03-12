class Virus{

constructor(server){

this.server = server

this.respawn()

this.mass = 100
this.fed = 0

this.vx = 0
this.vy = 0

}

respawn(){

this.x = Math.random()*this.server.mapSize
this.y = Math.random()*this.server.mapSize

}

update(){

this.x += this.vx
this.y += this.vy

this.vx *= 0.95
this.vy *= 0.95

}

}

module.exports = Virus
