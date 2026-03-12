const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let socket;
let players = {};
let myId;
let mouse = { x: 0, y: 0 };

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.onresize = resize;
resize();

$('#playBtn').click(() => {
    const nick = $('#nick').val() || "Unnamed";
    $('#overlays').hide();
    
    // Połącz z serwerem (lokalnie to localhost:3000)
    socket = io();

    socket.emit('join', nick);

    socket.on('init', (id) => { myId = id; });

    socket.on('update', (serverPlayers) => {
        players = serverPlayers;
    });
});

window.onmousemove = (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (socket) socket.emit('mouseMove', mouse);
};

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const showMass = $('#showMass').is(':checked');

    // Rysowanie graczy przysłanych z serwera
    for (let id in players) {
        let p = players[id];
        let ent = new Entity(p.x, p.y, p.mass, p.color, p.name);
        ent.draw(ctx, showMass);
    }

    requestAnimationFrame(loop);
}
loop();