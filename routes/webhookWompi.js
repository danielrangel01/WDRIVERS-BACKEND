// routes/webhookWompi.js
import express from 'express';
import Pago from '../models/Pago.js';
import axios from 'axios';

const router = express.Router();

const URL_WOMPI = 'https://sandbox.wompi.co/v1';
const PRIVATE_KEY = 'prv_test_xxxxx';

router.post('/notificaciones', async (req, res) => {
  const { data } = req.body;
  const { transaction } = data;

  try {
    // Consulta la transacción directamente a Wompi para verificar
    const wompiRes = await axios.get(`${URL_WOMPI}/transactions/${transaction.id}`, {
      headers: {
        Authorization: `Bearer ${PRIVATE_KEY}`
      }
    });

    const trx = wompiRes.data.data;

    if (trx.status === 'APPROVED') {
      // Guardar pago automáticamente
      await Pago.create({
        monto: trx.amount_in_cents / 100,
        vehiculo: 'vehiculoId', // Debes mapear con la referencia
        usuario: 'usuarioId',
        fecha: new Date()
      });

      console.log('✅ Pago aprobado por Wompi');
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Error en webhook Wompi:', err.message);
    res.sendStatus(500);
  }
});

export default router;
