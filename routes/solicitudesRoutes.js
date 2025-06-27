import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import SolicitudPago from '../models/SolicitudPago.js';
import Pago from '../models/Pago.js';
import { registrarActividad } from '../utils/logActivity.js';

const router = express.Router();

// Obtener solicitudes pendientes
router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const pendientes = await SolicitudPago.find({ estado: 'pendiente' })
      .populate('usuario', 'username')
      .populate('vehiculo', 'placa modelo tipo')
      .sort({ createdAt: -1 });

    res.json(pendientes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener solicitudes' });
  }
});

// Aprobar una solicitud
router.post('/:id/aprobar', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const solicitud = await SolicitudPago.findById(req.params.id).populate('usuario vehiculo');
    if (!solicitud || solicitud.estado !== 'pendiente') {
      return res.status(404).json({ message: 'Solicitud no encontrada o ya procesada' });
    }

    // Crear el pago definitivo
    await Pago.create({
      monto: solicitud.monto,
      vehiculo: solicitud.vehiculo._id,
      usuario: solicitud.usuario._id,
      fecha: new Date()
    });

    solicitud.estado = 'aprobado';
    await solicitud.save();

    await registrarActividad({
      usuarioId: req.userId,
      tipo: 'aprobacion pago',
      descripcion: `Aprobó un pago manual de $${solicitud.monto} para el vehículo ${solicitud.vehiculo.placa}`
    });

    res.json({ message: 'Pago aprobado y registrado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al aprobar pago' });
  }
});

export default router;
