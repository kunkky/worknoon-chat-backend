const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  getConversations,
  createConversation,
  getConversationById,
  deleteConversation,
} = require('../controllers/conversation.controller');

router.use(protect);

router.get('/', getConversations);
router.post('/', createConversation);
router.get('/:id', getConversationById);
router.delete('/:id', deleteConversation);

module.exports = router;
