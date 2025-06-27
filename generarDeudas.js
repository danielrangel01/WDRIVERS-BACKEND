import mongoose from "mongoose";
import User from "./models/User.js";
import Vehicle from "./models/Vehicle.js";
import Deuda from "./models/Deuda.js";
import Pago from "./models/Pago.js";
import { registrarActividad } from "./utils/logActivity.js";
import dotenv from "dotenv";
dotenv.config();

// Conexión a la base de datos
await mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Tarifa fija diaria
const TARIFA_DIARIA = 70000;

// Fecha de hoy sin hora
const fechaHoy = new Date();
fechaHoy.setHours(0, 0, 0, 0);

const conductores = await User.find({ role: "conductor", assignedVehicle: { $ne: null } }).populate("assignedVehicle");

// Generar deudas para conductores sin pago del día
for (const conductor of conductores) {
  // ¿Ya tiene deuda para hoy?
  const yaTieneDeuda = await Deuda.findOne({
    usuario: conductor._id,
    vehiculo: conductor.assignedVehicle._id,
    fecha: fechaHoy,
  });
  if (yaTieneDeuda) continue;

  // ¿Ya pagó hoy?
  const pagoHoy = await Deuda.db.model("Pago").findOne({
    usuario: conductor._id,
    vehiculo: conductor.assignedVehicle._id,
    fecha: { $gte: fechaHoy, $lte: new Date(fechaHoy.getTime() + 86399999) },
  });
  if (pagoHoy) continue;

  // Generar deuda
  const deuda = await Deuda.create({
    usuario: conductor._id,
    vehiculo: conductor.assignedVehicle._id,
    fecha: fechaHoy,
    monto: TARIFA_DIARIA,
    pagada: false,
  });

  // Registrar actividad
  await registrarActividad({
    usuarioId: conductor._id,
    tipo: "Deuda generada",
    descripcion: `Sistema generó deuda de $${TARIFA_DIARIA} al conductor ${conductor.username} para el vehículo ${conductor.assignedVehicle.placa} en fecha ${fechaHoy.toLocaleDateString()}`
  });

  console.log(
    `✔️ Deuda generada para ${conductor.username} - ${conductor.assignedVehicle.placa}`
  );
}

await mongoose.disconnect();
console.log("✅ Proceso terminado.");
