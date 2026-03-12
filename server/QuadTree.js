class QuadTree{

constructor(boundary,capacity){

this.boundary=boundary
this.capacity=capacity

this.points=[]

this.divided=false

}

subdivide(){

let x=this.boundary.x
let y=this.boundary.y
let w=this.boundary.w/2
let h=this.boundary.h/2

this.ne=new QuadTree({x:x+w,y:y,w,h},this.capacity)
this.nw=new QuadTree({x,y,w,h},this.capacity)
this.se=new QuadTree({x:x+w,y:y+h,w,h},this.capacity)
this.sw=new QuadTree({x,y:y+h,w,h},this.capacity)

this.divided=true

}

insert(point){

if(!this.contains(point)) return false

if(this.points.length<this.capacity){

this.points.push(point)
return true

}

if(!this.divided) this.subdivide()

return(

this.ne.insert(point)||
this.nw.insert(point)||
this.se.insert(point)||
this.sw.insert(point)

)

}

contains(p){

return(

p.x>=this.boundary.x&&
p.x<=this.boundary.x+this.boundary.w&&
p.y>=this.boundary.y&&
p.y<=this.boundary.y+this.boundary.h

)

}

query(range,found=[]){

if(!this.intersects(range)) return found

for(let p of this.points){

if(

p.x>=range.x&&
p.x<=range.x+range.w&&
p.y>=range.y&&
p.y<=range.y+range.h

) found.push(p)

}

if(this.divided){

this.ne.query(range,found)
this.nw.query(range,found)
this.se.query(range,found)
this.sw.query(range,found)

}

return found

}

intersects(range){

return!(

range.x>this.boundary.x+this.boundary.w||
range.x+range.w<this.boundary.x||
range.y>this.boundary.y+this.boundary.h||
range.y+range.h<this.boundary.y

)

}

}

module.exports=QuadTree
