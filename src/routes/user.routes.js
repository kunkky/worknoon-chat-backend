const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const {
  getAllUsers,
  getUserById,
  updateProfile,
  getAllUsersAdmin,
} = require('../controllers/user.controller');

router.use(protect);

router.get('/', getAllUsers);
router.get('/admin/all', authorize('admin'), getAllUsersAdmin);
router.get('/:id', getUserById);
router.patch('/me', updateProfile);

module.exports = router;
