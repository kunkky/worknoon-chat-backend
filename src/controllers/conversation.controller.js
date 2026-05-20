const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { getIO } = require('../socket');

exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', 'name email role avatar isOnline lastSeen')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createConversation = async (req, res) => {
  const { participantId, type = 'direct', name } = req.body;
  try {
    // For direct chats, reuse existing conversation
    if (type === 'direct') {
      const existing = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [req.user._id, participantId] },
      }).populate('participants', 'name email role avatar isOnline lastSeen');

      if (existing) return res.json({ conversation: existing });
    }

    const participants = type === 'direct'
      ? [req.user._id, participantId]
      : [req.user._id, ...(req.body.participants || [])];

    const conversation = await Conversation.create({
      participants,
      type,
      name: name || '',
      createdBy: req.user._id,
    });

    await conversation.populate('participants', 'name email role avatar isOnline lastSeen');

    // Notify every other participant so their sidebar updates in real-time
    const io = getIO();
    if (io) {
      conversation.participants.forEach((p) => {
        if (p._id.toString() !== req.user._id.toString()) {
          io.to(`user:${p._id}`).emit('new_conversation', { conversation });
        }
      });
    }

    res.status(201).json({ conversation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
    }).populate('participants', 'name email role avatar isOnline lastSeen');

    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ conversation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      $or: [{ createdBy: req.user._id }, { participants: req.user._id }],
    });

    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    await Message.deleteMany({ conversation: req.params.id });
    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
