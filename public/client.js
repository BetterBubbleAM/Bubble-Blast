const canvas = document.getElementById("gameCanvas")
const ctx = canvas.getContext("2d")

canvas.width = window.innerWidth
canvas.height = window.innerHeight

const socket = new WebSocket(`ws://${location.host}`)

let player = null
let cells = []
let foods = []

const mouse = { x: 0, y: 0 }

window.addEventListener("mousemove", e => {

    mouse.x = e.clientX
    mouse.y = e.clientY

})

socket.onmessage = (event) => {

    const data = JSON.parse(event.data)

    if (data.type === "state") {

        cells = data.cells
        foods = data.foods
        player = data.player

    }

}

function sendMove() {

    socket.send(JSON.stringify({
        type: "move",
        x: mouse.x,
        y: mouse.y
    }))

}

setInterval(sendMove, 40)

function draw() {

    ctx.clearRect(0,0,canvas.width,canvas.height)

    foods.forEach(food => {

        ctx.fillStyle = "#2ecc71"
        ctx.beginPath()
        ctx.arc(food.x, food.y, 4, 0, Math.PI*2)
        ctx.fill()

    })

    cells.forEach(cell => {

        ctx.fillStyle = "#3498db"

        ctx.beginPath()
        ctx.arc(cell.x, cell.y, cell.r, 0, Math.PI*2)
        ctx.fill()

    })

    requestAnimationFrame(draw)

}

draw()
