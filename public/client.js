const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize',resize);
resize();

class Entity{

    constructor(x,y,mass,color,name,type='player'){

        this.x=x;
        this.y=y;
        this.mass=mass;
        this.color=color;
        this.name=name||"";
        this.type=type;

        this.radius=Math.sqrt(this.mass*100/Math.PI);

    }

    draw(ctx){

        ctx.save();
        ctx.translate(this.x,this.y);

        if(this.type==="virus") this.drawVirus(ctx);
        else if(this.type==="food") this.drawFood(ctx);
        else if(this.type==="eject") this.drawEject(ctx);
        else this.drawCircle(ctx);

        ctx.restore();

    }

    drawFood(ctx){
        ctx.fillStyle=this.color;
        ctx.beginPath();
        ctx.arc(0,0,this.radius,0,Math.PI*2);
        ctx.fill();
    }

    drawEject(ctx){

        ctx.globalAlpha=0.9;

        ctx.fillStyle=this.color;

        ctx.beginPath();
        ctx.arc(0,0,this.radius,0,Math.PI*2);
        ctx.fill();

        ctx.globalAlpha=1;

    }

    drawCircle(ctx){

        ctx.globalAlpha=0.9;

        ctx.fillStyle=this.color;
        ctx.strokeStyle="rgba(0,0,0,0.2)";
        ctx.lineWidth=4;

        ctx.beginPath();
        ctx.arc(0,0,this.radius,0,Math.PI*2);
        ctx.fill();
        ctx.stroke();

        ctx.globalAlpha=1;

        if(this.mass>12){

            ctx.fillStyle="white";
            ctx.strokeStyle="black";
            ctx.lineWidth=3;

            ctx.textAlign="center";
            ctx.textBaseline="middle";

            let fontSize=Math.max(this.radius*0.35,10);

            ctx.font=`bold ${fontSize}px Ubuntu`;

            if(this.name){

                ctx.strokeText(this.name,0,-this.radius*0.15);
                ctx.fillText(this.name,0,-this.radius*0.15);

            }

            ctx.font=`${fontSize*0.6}px Ubuntu`;

            let m=Math.floor(this.mass);

            ctx.strokeText(m,0,this.radius*0.25);
            ctx.fillText(m,0,this.radius*0.25);

        }

    }

    drawVirus(ctx){

        const spikes=20;

        ctx.fillStyle="#33ff33";
        ctx.strokeStyle="#1c8f1c";
        ctx.lineWidth=4;

        ctx.beginPath();

        for(let i=0;i<spikes*2;i++){

            let r=i%2===0?this.radius:this.radius*0.85;
            let a=i*Math.PI/spikes;

            ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);

        }

        ctx.closePath();
        ctx.fill();
        ctx.stroke();

    }

}

const protocol=location.protocol==="https:"?"wss:":"ws:";
const ws=new WebSocket(`${protocol}//${location.host}`);

let gameState={players:{},food:[],viruses:[],ejectedMass:[]};

let myId=null;

let camX=2000;
let camY=2000;

let mouseX=2000;
let mouseY=2000;

let fovScale=1;

let isPlaying=false;

let lastState=null;

document.getElementById("playBtn").onclick=(e)=>{

    e.preventDefault();

    const nick=document.getElementById("nick").value;

    ws.send(JSON.stringify({
        type:"join",
        name:nick
    }));

    document.getElementById("overlays").style.display="none";

    isPlaying=true;

};

ws.onmessage=(e)=>{

    const data=JSON.parse(e.data);

    if(data.type==="init"){
        myId=data.id;
        return;
    }

    lastState=gameState;
    gameState=data;

};

window.addEventListener("mousemove",(e)=>{

    if(!isPlaying)return;

    mouseX=(e.clientX-canvas.width/2)/fovScale+camX;
    mouseY=(e.clientY-canvas.height/2)/fovScale+camY;

    ws.send(JSON.stringify({
        type:"move",
        x:mouseX,
        y:mouseY
    }));

});

let macro=null;

window.addEventListener("keydown",(e)=>{

    if(!isPlaying)return;

    if(e.code==="Space")
        ws.send(JSON.stringify({type:"split"}));

    if(e.code==="KeyW")
        ws.send(JSON.stringify({type:"eject"}));

    if(e.code==="KeyE"&&!macro){

        macro=setInterval(()=>{
            ws.send(JSON.stringify({type:"eject"}));
        },40);

    }

});

window.addEventListener("keyup",(e)=>{

    if(e.code==="KeyE"){
        clearInterval(macro);
        macro=null;
    }

});

function drawGrid(){

    ctx.strokeStyle="rgba(255,255,255,0.05)";
    ctx.lineWidth=1;

    for(let i=0;i<=4000;i+=50){

        ctx.beginPath();
        ctx.moveTo(i,0);
        ctx.lineTo(i,4000);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0,i);
        ctx.lineTo(4000,i);
        ctx.stroke();

    }

}

function drawMinimap(){

    const size=200;

    const x=canvas.width-size-20;
    const y=canvas.height-size-20;

    ctx.fillStyle="rgba(0,0,0,0.4)";
    ctx.fillRect(x,y,size,size);

    ctx.strokeStyle="white";
    ctx.strokeRect(x,y,size,size);

    Object.values(gameState.players).forEach(p=>{

        p.cells.forEach(c=>{

            let mx=x+(c.x/4000)*size;
            let my=y+(c.y/4000)*size;

            ctx.fillStyle=p.color;

            ctx.fillRect(mx,my,3,3);

        });

    });

}

function draw(){

    ctx.fillStyle="#111";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();

    ctx.translate(canvas.width/2,canvas.height/2);
    ctx.scale(fovScale,fovScale);
    ctx.translate(-camX,-camY);

    drawGrid();

    gameState.food.forEach(f=>{
        new Entity(f.x,f.y,f.mass,f.color,"","food").draw(ctx);
    });

    gameState.ejectedMass.forEach(m=>{
        new Entity(m.x,m.y,m.mass,m.color,"","eject").draw(ctx);
    });

    gameState.viruses.forEach(v=>{
        new Entity(v.x,v.y,v.mass,"#33ff33","","virus").draw(ctx);
    });

    Object.values(gameState.players).forEach(p=>{

        p.cells
        .sort((a,b)=>a.mass-b.mass)
        .forEach(c=>{

            new Entity(
                c.x,
                c.y,
                c.mass,
                p.color,
                p.name,
                "player"
            ).draw(ctx);

        });

    });

    let me=gameState.players[myId];

    if(me&&me.cells.length){

        let cx=0;
        let cy=0;
        let mass=0;

        me.cells.forEach(c=>{
            cx+=c.x;
            cy+=c.y;
            mass+=c.mass;
        });

        cx/=me.cells.length;
        cy/=me.cells.length;

        camX+= (cx-camX)*0.1;
        camY+= (cy-camY)*0.1;

        let target=Math.max(0.1,1.6-Math.log10(mass)*0.25);

        fovScale+= (target-fovScale)*0.08;

    }

    ctx.restore();

    drawMinimap();

    requestAnimationFrame(draw);

}

draw();
