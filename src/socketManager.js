const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Conversation = require('../models/conversationModel');
const { sendCallNotification } = require('../services/pushNotificationService');

let io = null;

/**
 * Находит всех собеседников пользователя и рассылает им статус
 */
async function broadcastUserStatus(userId, isOnline, lastSeen) {
  try {
    const conversations = await Conversation.find({
      participants: userId,
    }).select('participants').lean();

    const recipientIds = new Set();
    conversations.forEach((conv) => {
      conv.participants.forEach((p) => {
        if (String(p) !== String(userId)) {
          recipientIds.add(String(p));
        }
      });
    });

    const payload = { userId: String(userId), isOnline, lastSeen };
    recipientIds.forEach((recipientId) => {
      io.to(`user:${recipientId}`).emit('user_status', payload);
    });
  } catch (e) {
    console.error('[socket-chat] broadcastUserStatus error:', e.message);
  }
}

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

  io.on('connection', async (socket) => {
    console.log(`[socket-chat] User connected: ${socket.userId}`);
    socket.join(`user:${socket.userId}`);

    // Обновляем статус онлайн
    try {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: true,
        lastSeen: new Date(),
      });
      broadcastUserStatus(socket.userId, true, null);
    } catch (e) {
      console.error('[socket-chat] set online error:', e.message);
    }

    // ── WebRTC video call signaling ──────────────────────────────────

    socket.on('call:offer', async ({ to, offer, callerName, callerPhoto }) => {
      if (!to) return;

      io.to(`user:${String(to)}`).emit('call:incoming', {
        from: socket.userId,
        offer,
        callerName,
        callerPhoto,
      });

      // FCM push — если получатель не онлайн или приложение свёрнуто
      try {
        await sendCallNotification(
          to,
          { name: callerName, photo: callerPhoto },
          socket.userId
        );
      } catch (e) {
        console.error('[socket-chat] sendCallNotification error:', e.message);
      }
    });

    socket.on('call:answer', ({ to, answer }) => {
      if (!to) return;
      io.to(`user:${String(to)}`).emit('call:answered', {
        from: socket.userId,
        answer,
      });
    });

    socket.on('call:ice-candidate', ({ to, candidate }) => {
      if (!to) return;
      io.to(`user:${String(to)}`).emit('call:ice-candidate', {
        from: socket.userId,
        candidate,
      });
    });

    socket.on('call:end', ({ to }) => {
      if (!to) return;
      io.to(`user:${String(to)}`).emit('call:ended', { from: socket.userId });
    });

    socket.on('call:reject', ({ to }) => {
      if (!to) return;
      io.to(`user:${String(to)}`).emit('call:rejected', { from: socket.userId });
    });

    socket.on('call:camera_toggle', ({ to, isOn }) => {
      if (!to) return;
      io.to(`user:${String(to)}`).emit('call:camera_toggled', { from: socket.userId, isOn });
    });

    // ────────────────────────────────────────────────────────────────

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

    socket.on('disconnect', async () => {
      console.log(`[socket-chat] User disconnected: ${socket.userId}`);
      const lastSeen = new Date();
      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen,
        });
        broadcastUserStatus(socket.userId, false, lastSeen);
      } catch (e) {
        console.error('[socket-chat] set offline error:', e.message);
      }
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
