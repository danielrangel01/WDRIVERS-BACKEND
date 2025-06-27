import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import Pago from '../models/Pago.js';
import Expense from '../models/Expense.js';
import Deuda from '../models/Deuda.js';
import Vehicle from '../models/Vehicle.js';

const router = express.Router();

router.get('/resumen', authMiddleware, requireRole('admin'), async (req, res) => {
  const hoy = new Date();
  const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

  // SOLO DEUDAS NO PAGADAS
  const [pagosHoy, pagosMes, gastosMes, deudasNoPagadas] = await Promise.all([
    Pago.find({ fecha: { $gte: inicioDia, $lte: finDia } }),
    Pago.find({ fecha: { $gte: inicioMes, $lte: finMes } }),
    Expense.find({ fecha: { $gte: inicioMes, $lte: finMes } }),
    Deuda.find({ fecha: { $gte: inicioMes, $lte: finMes }, pagada: false }).populate('vehiculo')
  ]);

  const totalHoy = pagosHoy.reduce((sum, p) => sum + p.monto, 0);
  const totalMes = pagosMes.reduce((sum, p) => sum + p.monto, 0);
  const totalGastosMes = gastosMes.reduce((sum, g) => sum + g.monto, 0);
  const totalDeudasMes = deudasNoPagadas.reduce((sum, d) => sum + d.monto, 0);
  const utilidadMes = totalMes - totalGastosMes;

  // Desglose por vehículo
  const vehiculos = await Vehicle.find();
  const utilidadesPorVehiculo = vehiculos.map((v) => {
    const ingresos = pagosMes.filter(p => p.vehiculo?.toString() === v._id.toString()).reduce((sum, p) => sum + p.monto, 0);
    const gastos = gastosMes.filter(g => g.vehiculo?.toString() === v._id.toString()).reduce((sum, g) => sum + g.monto, 0);
    const deudas = deudasNoPagadas.filter(d => d.vehiculo?._id?.toString() === v._id.toString()).reduce((sum, d) => sum + d.monto, 0);
    return {
      vehiculo: v.placa,
      ingresos,
      gastos,
      deudas,
      utilidad: ingresos - gastos,
    };
  });

  const vehiculosAlquiladosHoy = new Set(pagosHoy.map(p => p.vehiculo?.toString())).size;
  const conductoresHoy = new Set(pagosHoy.map(p => p.usuario?.toString())).size;

  res.json({
    ingresosHoy: totalHoy,
    ingresosMes: totalMes,
    vehiculosHoy: vehiculosAlquiladosHoy,
    conductoresHoy,
    utilidadMes,
    totalDeudasMes, // total general de deudas NO pagadas
    utilidadesPorVehiculo, // Incluye deudas por vehículo
  });
});

export default router;
