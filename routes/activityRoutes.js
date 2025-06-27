import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  const logs = await ActivityLog.find().populate('usuario', 'username').sort({ fecha: -1 });
  res.json(logs);
});

export default router;
