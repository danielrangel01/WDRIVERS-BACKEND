// backend/routes/pagosWompi.js
import express from 'express';
import Pago from '../models/Pago.js';
import SolicitudPago from '../models/SolicitudPago.js';
import { authMiddleware } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

console.log('🔑 Clave pública Wompi:', process.env.PUBLIC_KEY_WOMPI);

// Iniciar pago PSE
router.post('/iniciar', authMiddleware, async (req, res) => {
  try {
    const { monto, vehiculoId } = req.body;
    const referencia = crypto.randomBytes(8).toString('hex');

    const url = `https://checkout.wompi.co/p/?public-key=${process.env.PUBLIC_KEY_WOMPI}&currency=COP&amount-in-cents=${monto * 100}&reference=${referencia}&redirect-url=http://localhost:5173/pago-exitoso`;
    await SolicitudPago.create({
      monto,
      vehiculo: vehiculoId,
      usuario: req.userId,
      estado: 'pendiente',
      referencia
    });

    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al iniciar pago PSE' });
  }
});

// Endpoint para recibir confirmación de Wompi
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const evento = req.body;

    if (evento.event === 'transaction.updated' && evento.data.status === 'APPROVED') {
      const referencia = evento.data.reference;
      const solicitud = await SolicitudPago.findOne({ referencia }).populate('usuario vehiculo');
      if (!solicitud || solicitud.estado !== 'pendiente') return res.sendStatus(404);

      await Pago.create({
        monto: solicitud.monto,
        vehiculo: solicitud.vehiculo._id,
        usuario: solicitud.usuario._id,
        fecha: new Date()
      });

      solicitud.estado = 'aprobado';
      await solicitud.save();
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

export default router;
