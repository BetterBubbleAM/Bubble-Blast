const express = require("express")
const http = require("http")
const WebSocket = require("ws")
const path = require("path")

const GameServer = require("./server/GameServer")

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

app.use(express.static(path.join(__dirname,"public")))

app.get("/",(req,res)=>{
res.sendFile(path.join(__dirname,"public","index.html"))
})

const game = new GameServer()

wss.on("connection",(ws)=>{

game.addClient(ws)

})

const PORT = process.env.PORT || 10000

server.listen(PORT,()=>{

console.log("ULTRA Bubble Engine running")

game.start()

})
