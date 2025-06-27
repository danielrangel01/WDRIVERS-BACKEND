import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import Pago from '../models/Pago.js';
import Expense from '../models/Expense.js';
import Deuda from '../models/Deuda.js';
import Vehicle from '../models/Vehicle.js';
import ExcelJS from 'exceljs';

const router = express.Router();

router.get('/mensual', authMiddleware, requireRole('admin'), async (req, res) => {
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const finMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

  const pagos = await Pago.find({ fecha: { $gte: inicioMes, $lte: finMes } }).populate('vehiculo');
  const gastos = await Expense.find({ fecha: { $gte: inicioMes, $lte: finMes } }).populate('vehiculo');
  const deudas = await Deuda.find({ fecha: { $gte: inicioMes, $lte: finMes }, pagada: false }).populate('vehiculo');
  const vehiculos = await Vehicle.find();

  const desglose = {};

  pagos.forEach(p => {
    const placa = p.vehiculo?.placa || 'Sin placa';
    if (!desglose[placa]) desglose[placa] = { ingresos: 0, gastos: 0, deudas: 0 };
    desglose[placa].ingresos += p.monto;
  });

  gastos.forEach(g => {
    const placa = g.vehiculo?.placa || 'Sin placa';
    if (!desglose[placa]) desglose[placa] = { ingresos: 0, gastos: 0, deudas: 0 };
    desglose[placa].gastos += g.monto;
  });

  deudas.forEach(d => {
    const placa = d.vehiculo?.placa || 'Sin placa';
    if (!desglose[placa]) desglose[placa] = { ingresos: 0, gastos: 0, deudas: 0 };
    desglose[placa].deudas += d.monto;
  });

  const resumen = Object.entries(desglose).map(([placa, datos]) => ({
    placa,
    ingresos: datos.ingresos,
    gastos: datos.gastos,
    deudas: datos.deudas,
    utilidad: datos.ingresos - datos.gastos
  }));

  const ingresosTotales = resumen.reduce((acc, r) => acc + r.ingresos, 0);
  const gastosTotales = resumen.reduce((acc, r) => acc + r.gastos, 0);
  const totalDeudas = resumen.reduce((acc, r) => acc + r.deudas, 0);
  const utilidadTotal = ingresosTotales - gastosTotales;

  // Movimientos para mostrar y para excel
  const movimientos = [
    ...pagos.map(p => ({
      fecha: p.fecha.toISOString(),
      tipo: 'Ingreso',
      descripcion: 'Pago de alquiler',
      monto: p.monto,
      placa: p.vehiculo?.placa || 'Sin placa'
    })),
    ...gastos.map(g => ({
      fecha: g.fecha.toISOString(),
      tipo: 'Gasto',
      descripcion: g.descripcion,
      monto: g.monto,
      placa: g.vehiculo?.placa || 'Sin placa'
    })),
    ...deudas.map(d => ({
      fecha: d.fecha.toISOString(),
      tipo: 'Deuda',
      descripcion: 'Día sin pago',
      monto: d.monto,
      placa: d.vehiculo?.placa || 'Sin placa'
    }))
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  res.json({
    movimientos,
    resumen,
    totales: {
      ingresosTotales,
      gastosTotales,
      totalDeudas,
      utilidadTotal
    }
  });
});

// Excel completo: incluye detalle de deudas pendientes
router.get('/mensual/excel', authMiddleware, requireRole('admin'), async (req, res) => {
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const finMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

  const pagos = await Pago.find({ fecha: { $gte: inicioMes, $lte: finMes } }).populate('vehiculo');
  const gastos = await Expense.find({ fecha: { $gte: inicioMes, $lte: finMes } }).populate('vehiculo');
  const deudas = await Deuda.find({ fecha: { $gte: inicioMes, $lte: finMes }, pagada: false }).populate('vehiculo');
  const vehiculos = await Vehicle.find();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Resumen Mensual');

  // Encabezado
  sheet.addRow(['REPORTE MENSUAL DE VEHÍCULOS']);
  sheet.addRow([]);
  sheet.addRow(['PLACA', 'INGRESOS', 'GASTOS', 'DEUDAS PENDIENTES', 'UTILIDAD']);

  let totalIngresos = 0;
  let totalGastos = 0;
  let totalDeudas = 0;

  for (const v of vehiculos) {
    const ingresos = pagos
      .filter(p => p.vehiculo?.placa === v.placa)
      .reduce((sum, p) => sum + p.monto, 0);

    const egresos = gastos
      .filter(g => g.vehiculo?.placa === v.placa)
      .reduce((sum, g) => sum + g.monto, 0);

    const deudasPend = deudas
      .filter(d => d.vehiculo?.placa === v.placa)
      .reduce((sum, d) => sum + d.monto, 0);

    const utilidad = ingresos - egresos;

    totalIngresos += ingresos;
    totalGastos += egresos;
    totalDeudas += deudasPend;

    sheet.addRow([v.placa, ingresos, egresos, deudasPend, utilidad]);
  }

  sheet.addRow([]);
  sheet.addRow(['TOTAL GENERAL', totalIngresos, totalGastos, totalDeudas, totalIngresos - totalGastos]);

  // Hoja de gastos detallados
  const detalle = workbook.addWorksheet('Gastos Detallados');
  detalle.addRow(['PLACA', 'DESCRIPCIÓN', 'MONTO', 'FECHA']);

  gastos.forEach(g => {
    detalle.addRow([
      g.vehiculo?.placa || 'Sin placa',
      g.descripcion,
      g.monto,
      g.fecha.toLocaleDateString()
    ]);
  });

  // Hoja de deudas pendientes (detallado)
  const detalleDeudas = workbook.addWorksheet('Deudas Pendientes');
  detalleDeudas.addRow(['PLACA', 'MONTO', 'FECHA']);

  deudas.forEach(d => {
    detalleDeudas.addRow([
      d.vehiculo?.placa || 'Sin placa',
      d.monto,
      d.fecha.toLocaleDateString()
    ]);
  });

  // Enviar archivo
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=reporte_mensual.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
