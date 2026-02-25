const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  // JWT auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Unauthorized'));
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const userId = payload.sub || payload.userId || payload.id;
      if (!userId) return next(new Error('Invalid token'));
      socket.userId = String(userId);
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket-chat] User connected: ${socket.userId}`);
    // Join personal room
    socket.join(`user:${socket.userId}`);

    // Typing indicator
    socket.on('typing_start', ({ recipientId }) => {
      if (!recipientId) return;
      io.to(`user:${String(recipientId)}`).emit('typing', {
        senderId: socket.userId,
        isTyping: true,
      });
    });

    socket.on('typing_stop', ({ recipientId }) => {
      if (!recipientId) return;
      io.to(`user:${String(recipientId)}`).emit('typing', {
        senderId: socket.userId,
        isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[socket-chat] User disconnected: ${socket.userId}`);
    });
  });

  return io;
}

function getIO() {
  return io;
}

/**
 * Emit event to a specific user's room
 */
function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${String(userId)}`).emit(event, data);
}

module.exports = { initSocketIO, getIO, emitToUser };
