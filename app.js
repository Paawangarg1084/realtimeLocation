const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;
  });

  socket.on("send-location", (data) => {
    // FIXED: Broadcast to others in the same room
    if (!data.roomId) return;
    socket.to(data.roomId).emit("receive-location", {
      lat: data.lat,
      lng: data.lng,
      id: socket.id,
      username: socket.username || "User"
    });
  });

  socket.on("disconnect", () => {
    if (socket.roomId) {
      io.to(socket.roomId).emit("user-disconnected", socket.id);
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
