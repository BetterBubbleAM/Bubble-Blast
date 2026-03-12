const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let players = {};
let food = [];
let myId = null;
let camX = 2500, camY = 2500;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.onresize = resize;
resize();

$('#playBtn').click(() => {
    socket.emit('join', $('#nick').val());
    $('#overlays').hide();
});

window.onkeydown = (e) => {
    if (e.keyCode === 27) $('#overlays').show(); // ESC
};

window.onmousemove = (e) => {
    // Wysyłamy pozycję myszki relatywną do środka ekranu
    socket.emit('input', {
        x: e.clientX - canvas.width / 2,
        y: e.clientY - canvas.height / 2
    });
};

socket.on('init', (id) => { myId = id; });
socket.on('update', (data) => {
    players = data.players;
    food = data.food;
});

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (myId && players[myId]) {
        camX = players[myId].x;
        camY = players[myId].y;
    }

    ctx.save();
    ctx.translate(canvas.width / 2 - camX, canvas.height / 2 - camY);

    // Siatka tła
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5000; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 5000); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(5000, i); ctx.stroke();
    }

    // Jedzenie
    food.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
        ctx.fill();
    });

    // Gracze
    for (let id in players) {
        let p = players[id];
        new Entity(p.x, p.y, p.mass, p.color, p.name).draw(ctx);
    }

    ctx.restore();
    requestAnimationFrame(draw);
}
draw();
