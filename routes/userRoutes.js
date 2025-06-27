import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { registrarActividad } from '../utils/logActivity.js';

const router = express.Router();

// Obtener todos los usuarios (solo admin)
router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  const usuarios = await User.find().populate('assignedVehicle');
  res.json(usuarios);
});

// Eliminar usuario y liberar vehículo
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const usuario = await User.findById(req.params.id);
  if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

  // Quitar asignación de vehículo
  usuario.assignedVehicle = null;
  await usuario.save();

  // Eliminar usuario
  await User.findByIdAndDelete(req.params.id);

  res.json({ message: 'Usuario eliminado y vehículo liberado' });
});

// Crear nuevo usuario (solo admin)
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  const { username, password, role, assignedVehicle } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  const nuevo = new User({ username, password: hashed, role, assignedVehicle });
  await nuevo.save();

   await registrarActividad({
     usuarioId: req.userId,
     tipo: 'Creacion de usuario',
     descripcion: `Creo el usuario ${username} con rol ${role}`
  });

  res.status(201).json(nuevo);
});

export default router;
