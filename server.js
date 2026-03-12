const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname,"public")));

app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname,"public","index.html"));
});
const TICKRATE = 30;
const MAP_SIZE = 4000;

const START_MASS = 20;
const EAT_RATIO = 1.25;
const MASS_DECAY = 0.002;

let players = {};
let viruses = [];
let food = [];
let ejectedMass = [];

const colors = ['#f44336','#3f51b5','#4caf50','#ff9800','#9c27b0','#00bcd4','#e91e63'];

function getRadius(mass){
    return Math.sqrt(mass * 100 / Math.PI);
}

function randPos(){
    return Math.random()*MAP_SIZE;
}

function spawnFood(id){
    food[id] = {
        id,
        x: randPos(),
        y: randPos(),
        mass:1,
        color: colors[Math.floor(Math.random()*colors.length)]
    };
}

function spawnVirus(id,x,y,vx=0,vy=0){
    viruses[id]={
        id,
        x: x ?? randPos(),
        y: y ?? randPos(),
        mass:100,
        fed:0,
        vx,
        vy
    };
}

for(let i=0;i<800;i++) spawnFood(i);
for(let i=0;i<20;i++) spawnVirus(i);

wss.on('connection',ws=>{

    let id = Math.random().toString();

    ws.send(JSON.stringify({type:"init",id}));

    ws.on('message',msg=>{

        let data = JSON.parse(msg);

        if(data.type==="join"){

            players[id]={
                id,
                name:data.name,
                mouseX:MAP_SIZE/2,
                mouseY:MAP_SIZE/2,
                color: colors[Math.floor(Math.random()*colors.length)],
                cells:[{
                    x:randPos(),
                    y:randPos(),
                    mass:START_MASS,
                    vx:0,
                    vy:0
                }]
            };

            return;
        }

        if(!players[id]) return;

        let p = players[id];

        if(data.type==="move"){
            p.mouseX=data.x;
            p.mouseY=data.y;
        }

        if(data.type==="split"){

            if(p.cells.length>=16) return;

            let newCells=[];

            p.cells.forEach(cell=>{

                if(cell.mass<36) return;

                if(p.cells.length+newCells.length>=16) return;

                cell.mass/=2;

                let angle=Math.atan2(p.mouseY-cell.y,p.mouseX-cell.x);

                newCells.push({
                    x:cell.x,
                    y:cell.y,
                    mass:cell.mass,
                    vx:Math.cos(angle)*70,
                    vy:Math.sin(angle)*70
                });

            });

            p.cells.push(...newCells);
        }

        if(data.type==="eject"){

            p.cells.forEach(cell=>{

                if(cell.mass<35) return;

                cell.mass-=15;

                let angle=Math.atan2(p.mouseY-cell.y,p.mouseX-cell.x);
                let r=getRadius(cell.mass);

                ejectedMass.push({
                    id:Math.random(),
                    x:cell.x+Math.cos(angle)*r,
                    y:cell.y+Math.sin(angle)*r,
                    mass:12,
                    color:p.color,
                    vx:Math.cos(angle)*80,
                    vy:Math.sin(angle)*80
                });

            });

        }

    });

    ws.on('close',()=>delete players[id]);

});

setInterval(()=>{

    let pIds = Object.keys(players);

    // eject physics
    for(let i=ejectedMass.length-1;i>=0;i--){

        let m=ejectedMass[i];

        m.x+=m.vx;
        m.y+=m.vy;

        m.vx*=0.9;
        m.vy*=0.9;

        m.x=Math.max(0,Math.min(MAP_SIZE,m.x));
        m.y=Math.max(0,Math.min(MAP_SIZE,m.y));

    }

    // virus physics
    viruses.forEach(v=>{

        v.x+=v.vx;
        v.y+=v.vy;

        v.vx*=0.95;
        v.vy*=0.95;

    });

    pIds.forEach(id=>{

        let p=players[id];

        for(let i=p.cells.length-1;i>=0;i--){

            let cell=p.cells[i];

            // movement

            let base=400;
            let speed=(2.2*Math.pow(cell.mass,-0.44)*base)/TICKRATE;

            let angle=Math.atan2(p.mouseY-cell.y,p.mouseX-cell.x);

            cell.x+=Math.cos(angle)*speed+cell.vx;
            cell.y+=Math.sin(angle)*speed+cell.vy;

            cell.vx*=0.85;
            cell.vy*=0.85;

            cell.x=Math.max(0,Math.min(MAP_SIZE,cell.x));
            cell.y=Math.max(0,Math.min(MAP_SIZE,cell.y));

            // mass decay

            if(cell.mass>500){
                let loss=(cell.mass*MASS_DECAY)/TICKRATE;
                cell.mass-=loss;
            }

            if(cell.mass<START_MASS) cell.mass=START_MASS;

            let r1=getRadius(cell.mass);

            // food

            food.forEach((f,fi)=>{

                if(Math.hypot(cell.x-f.x,cell.y-f.y)<r1){

                    cell.mass+=f.mass;
                    spawnFood(fi);

                }

            });

            // eat ejected

            for(let j=ejectedMass.length-1;j>=0;j--){

                let em=ejectedMass[j];

                if(Math.hypot(cell.x-em.x,cell.y-em.y)<r1){

                    cell.mass+=em.mass;
                    ejectedMass.splice(j,1);

                }

            }

            // PLAYER EAT SYSTEM

            pIds.forEach(id2=>{

                if(id===id2) return;

                let p2=players[id2];

                for(let j=p2.cells.length-1;j>=0;j--){

                    let c2=p2.cells[j];

                    let r2=getRadius(c2.mass);

                    let dist=Math.hypot(cell.x-c2.x,cell.y-c2.y);

                    let bigger = cell.mass > c2.mass ? cell : c2;
                    let smaller = cell.mass > c2.mass ? c2 : cell;

                    let rBig = getRadius(bigger.mass);
                    let rSmall = getRadius(smaller.mass);

                    if(dist < rBig - rSmall){

                        if(bigger.mass >= smaller.mass * EAT_RATIO){

                            bigger.mass += smaller.mass;

                            if(smaller===cell){
                                p.cells.splice(i,1);
                            }else{
                                p2.cells.splice(j,1);
                            }

                        }

                    }

                }

            });

            if(!p.cells[i]) continue;

            // VIRUS COLLISION

            viruses.forEach((v,vi)=>{

                let dist=Math.hypot(cell.x-v.x,cell.y-v.y);

                if(dist<r1){

                    if(cell.mass>=v.mass*EAT_RATIO){

                        if(p.cells.length===16){

                            cell.mass+=v.mass;

                        }else{

                            let parts=Math.min(16-p.cells.length,Math.floor(cell.mass/20));

                            let newMass=cell.mass/parts;

                            cell.mass=newMass;

                            for(let k=0;k<parts-1;k++){

                                p.cells.push({
                                    x:cell.x,
                                    y:cell.y,
                                    mass:newMass,
                                    vx:(Math.random()-0.5)*90,
                                    vy:(Math.random()-0.5)*90
                                });

                            }

                        }

                        spawnVirus(vi);

                    }

                }

            });

        }

        if(p.cells.length===0){

            p.cells.push({
                x:randPos(),
                y:randPos(),
                mass:START_MASS,
                vx:0,
                vy:0
            });

        }

    });

    // virus feeding

    for(let j=ejectedMass.length-1;j>=0;j--){

        let em=ejectedMass[j];

        let hit=false;

        viruses.forEach((v,vi)=>{

            if(hit) return;

            if(Math.hypot(em.x-v.x,em.y-v.y)<getRadius(v.mass)){

                v.fed++;
                hit=true;

                if(v.fed>=7){

                    v.fed=0;

                    let angle=Math.atan2(em.vy,em.vx);

                    spawnVirus(
                        viruses.length,
                        v.x,
                        v.y,
                        Math.cos(angle)*40,
                        Math.sin(angle)*40
                    );

                }

            }

        });

        if(hit) ejectedMass.splice(j,1);

    }

    let state=JSON.stringify({players,food,viruses,ejectedMass});

    wss.clients.forEach(c=>{
        if(c.readyState===WebSocket.OPEN) c.send(state);
    });

},1000/TICKRATE);

const PORT=process.env.PORT||10000;

server.listen(PORT,()=>console.log("Bubble engine running"));
