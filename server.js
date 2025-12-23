const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const path = require("path");

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rooms data structure: { roomName: { socketId: userName, ... } }
const rooms = {};

// Helper to get current HH:MM timestamp
function getTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Join room
  socket.on("join-room", ({ name, room, font, color }) => {
    socket.name = name;
    socket.room = room;
    socket.font = font;
    socket.color = color;

    if (!rooms[room]) rooms[room] = {};
    rooms[room][socket.id] = name;

    socket.join(room);

    // Notify others in room
    io.to(room).emit("system-message", {
      text: `${name} joined the room`,
      time: getTime()
    });

    // Send updated user list
    io.to(room).emit("user-list", Object.values(rooms[room]));
  });

  // Leave room
  socket.on("leave-room", () => {
    if (!socket.room || !socket.name) return;
    const room = socket.room;
    const name = socket.name;

    if (rooms[room]) {
      delete rooms[room][socket.id];
      io.to(room).emit("system-message", {
        text: `${name} left the room`,
        time: getTime()
      });
      io.to(room).emit("user-list", Object.values(rooms[room]));
    }

    socket.leave(room);
    socket.room = null;
  });

  // Chat message
socket.on("chat-message", (data) => {
  if (!socket.room || !socket.name) return;

  const message = {
    name: socket.name,
    text: data.text || null,
    image: data.image || null,
    font: data.font || socket.font || "Arial",
    color: data.color || socket.color || "#000000",
    size: data.size || "14px",
    time: getTime()
  };

  io.to(socket.room).emit("chat-message", message);
});



  // Typing indicators
  socket.on("typing", () => {
    if (socket.room && socket.name) {
      socket.to(socket.room).emit("typing", socket.name);
    }
  });

  socket.on("stop-typing", () => {
    if (socket.room && socket.name) {
      socket.to(socket.room).emit("stop-typing", socket.name);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (socket.room && socket.name && rooms[socket.room]) {
      const room = socket.room;
      const name = socket.name;

      delete rooms[room][socket.id];
      io.to(room).emit("system-message", {
        text: `${name} disconnected`,
        time: getTime()
      });
      io.to(room).emit("user-list", Object.values(rooms[room]));
    }
    console.log("A user disconnected:", socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
