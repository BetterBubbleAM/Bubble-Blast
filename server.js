const express = require("express")
const http = require("http")
const WebSocket = require("ws")
const GameServer = require("./server/GameServer")

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

const gameServer = new GameServer()

app.use(express.static("public"))

wss.on("connection", (ws) => {

    const player = gameServer.addPlayer(ws)

    ws.on("message", (msg) => {
        gameServer.handleMessage(player, msg)
    })

    ws.on("close", () => {
        gameServer.removePlayer(player)
    })
})

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
    console.log("Server running on port", PORT)
})
