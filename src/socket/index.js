const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const socketUserMap = new Map();
const userSocketMap = new Map();

let io;

const getIO = () => io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    socketUserMap.set(socket.id, userId);
    userSocketMap.set(userId, socket.id);

    // Each user joins a personal room so they can be targeted directly
    socket.join(`user:${userId}`);

    await User.findByIdAndUpdate(userId, { isOnline: true });
    socket.broadcast.emit('user_online', { userId });

    socket.on('join_conversations', async () => {
      const conversations = await Conversation.find({ participants: userId });
      conversations.forEach((c) => socket.join(c._id.toString()));
    });

    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
    });

    socket.on('send_message', async ({ conversationId, content }) => {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });
        if (!conversation) return;

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          content,
          readBy: [userId],
        });

        await message.populate('sender', 'name avatar role');
        await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });

        io.to(conversationId).emit('new_message', { message });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('typing_start', ({ conversationId }) => {
      socket.to(conversationId).emit('typing', {
        userId,
        name: socket.user.name,
        conversationId,
      });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      socket.to(conversationId).emit('stop_typing', { userId, conversationId });
    });

    socket.on('mark_read', async ({ conversationId }) => {
      try {
        await Message.updateMany(
          { conversation: conversationId, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
        socket.to(conversationId).emit('messages_read', { conversationId, userId });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', async () => {
      socketUserMap.delete(socket.id);
      userSocketMap.delete(userId);

      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });
      socket.broadcast.emit('user_offline', { userId, lastSeen: new Date() });
    });
  });

  return io;
};

module.exports = { initSocket, getIO };
