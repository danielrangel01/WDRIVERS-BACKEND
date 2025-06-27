import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import Expense from '../models/Expense.js';
import { registrarActividad } from '../utils/logActivity.js';

const router = express.Router();

router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  const { vehiculo, monto, descripcion } = req.body;
  const gasto = await Expense.create({ vehiculo, monto, descripcion });
  await registrarActividad({ usuarioId: req.user.id, tipo: 'gasto', descripcion: `Gasto: ${descripcion} - $${monto}` });
  res.status(201).json(gasto);
});

export default router;

router.get('/vehiculo/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const gastos = await Expense.find({ vehiculo: req.params.id }).sort({ fecha: -1 });
  res.json(gastos);
});