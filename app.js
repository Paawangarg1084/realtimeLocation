const express = require('express');
const app = express();

const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ✅ JOIN ROOM WITH USERNAME
  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    console.log(`${username} joined room ${roomId}`);
  });

  // ✅ SEND LOCATION WITH NAME
  socket.on("send-location", (data) => {
    const { lat, lng } = data;

    if (socket.roomId) {
      io.to(socket.roomId).emit("receive-location", {
        lat,
        lng,
        id: socket.id,
        username: socket.username // 🔥 ADD THIS
      });
    }
  });

  // ✅ REMOVE USER
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    if (socket.roomId) {
      io.to(socket.roomId).emit("user-disconnected", socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});