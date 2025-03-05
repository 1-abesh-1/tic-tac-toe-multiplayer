const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

const calculateWinner = (squares) => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ];

  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }

  if (squares.every(square => square !== null)) {
    return 'draw';
  }

  return null;
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', () => {
    const roomId = Math.random().toString(36).substring(7);
    rooms.set(roomId, {
      players: [socket.id],
      board: Array(9).fill(null),
      currentTurn: socket.id
    });
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, symbol: 'X' });
  });

  socket.on('joinRoom', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.players.length < 2) {
      room.players.push(socket.id);
      socket.join(roomId);
      socket.emit('joinedRoom', { roomId, symbol: 'O' });
      io.to(roomId).emit('gameStart', { board: room.board });
    } else {
      socket.emit('roomError', 'Room is full or does not exist');
    }
  });

  socket.on('makeMove', ({ roomId, index, symbol }) => {
    const room = rooms.get(roomId);
    if (room && room.currentTurn === socket.id && !room.board[index]) {
      room.board[index] = symbol;
      room.currentTurn = room.players.find(id => id !== socket.id);
      
      io.to(roomId).emit('updateGame', { board: room.board });
      
      const winner = calculateWinner(room.board);
      if (winner) {
        io.to(roomId).emit('gameOver', { winner });
        rooms.delete(roomId);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    rooms.forEach((room, roomId) => {
      if (room.players.includes(socket.id)) {
        io.to(roomId).emit('playerLeft');
        rooms.delete(roomId);
      }
    });
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
