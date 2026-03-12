class Food{

constructor(server){

this.server = server

this.respawn()

}

respawn(){

this.x = Math.random()*4000
this.y = Math.random()*4000

this.mass = 1

}

}

module.exports = Food
