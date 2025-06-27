import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/vehiculo', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('assignedVehicle');
    if (user?.role === 'conductor' && user.assignedVehicle) {
      res.json(user.assignedVehicle);
    } else {
      res.status(404).json({ message: 'No se encontró vehículo asignado' });
    }
  } catch {
    res.status(500).json({ message: 'Error al consultar vehículo' });
  }
});

export default router;