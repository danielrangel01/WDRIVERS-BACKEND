import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  const logs = await ActivityLog.find().populate('usuario', 'username').sort({ fecha: -1 });
  res.json(logs);
});

// Obtener cantidad de actividades no leídas
router.get("/notificaciones/no-leidas", authMiddleware, requireRole("admin"), async (req, res) => {
  const count = await Actividad.countDocuments({ leida: false });
  res.json({ noLeidas: count });
});

router.post("/marcar-leidas", authMiddleware, requireRole("admin"), async (req, res) => {
  await Actividad.updateMany({ leida: false }, { leida: true });
  res.json({ ok: true });
});

export default router;
