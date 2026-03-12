class Cell{

constructor(server,owner,x,y,mass){

this.server=server

this.owner=owner

this.x=x
this.y=y

this.mass=mass

this.vx=0
this.vy=0

this.mergeTime=0

}

update(){

let dx=this.owner.mouseX-this.x
let dy=this.owner.mouseY-this.y

let dist=Math.sqrt(dx*dx+dy*dy)

let speed=50/Math.sqrt(this.mass)

if(dist>1){

this.x+=dx/dist*speed
this.y+=dy/dist*speed

}

this.x+=this.vx
this.y+=this.vy

this.vx*=0.9
this.vy*=0.9

if(this.mergeTime>0)
this.mergeTime--

}

canMerge(){

return this.mergeTime<=0

}

}

module.exports=Cell
