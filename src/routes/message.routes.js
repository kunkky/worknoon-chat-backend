const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  getMessages,
  sendMessage,
  markRead,
  deleteMessage,
} = require('../controllers/message.controller');

router.use(protect);

router.get('/:conversationId', getMessages);
router.post('/:conversationId', sendMessage);
router.patch('/:conversationId/read', markRead);
router.delete('/:id', deleteMessage);

module.exports = router;
