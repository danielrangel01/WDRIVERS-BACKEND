import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import Vehicle from '../models/Vehicle.js';
import User from '../models/User.js'; // Asegúrate de importar el modelo User

const router = express.Router();

// Crear vehículo (solo admin)
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  const { placa, modelo, tipo, tarifaDiaria } = req.body;
  const nuevoVehiculo = await Vehicle.create({ placa, modelo, tipo, tarifaDiaria });
  res.status(201).json(nuevoVehiculo);
});

// Obtener todos los vehículos (admin o conductor)
router.get('/', authMiddleware, async (req, res) => {
  const vehiculos = await Vehicle.find();
  res.json(vehiculos);
});

// 🔽 NUEVA RUTA: Obtener vehículos no asignados
router.get('/disponibles', authMiddleware, requireRole('admin'), async (req, res) => {
  const usados = await User.find({ assignedVehicle: { $ne: null } }, 'assignedVehicle');
  const usadosIds = usados.map(u => u.assignedVehicle?.toString());
  const disponibles = await Vehicle.find({ _id: { $nin: usadosIds } });
  res.json(disponibles);
});

export default router;
