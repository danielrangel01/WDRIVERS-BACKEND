// backend/routes/cronRoutes.js
import express from "express";
import User from "../models/User.js";
import Deuda from "../models/Deuda.js";
import { registrarActividad } from "../utils/logActivity.js";

const router = express.Router();

router.post("/cron-generar-deudas", async (req, res) => {
  const cronSecret = req.headers["x-cron-secret"];
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: "No autorizado" });
  }

  const conductores = await User.find({ role: "conductor" }).populate("assignedVehicle");
  const fechaHoy = new Date();
  const inicioDia = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), fechaHoy.getDate());
  const finDia = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), fechaHoy.getDate(), 23, 59, 59, 999);

  let creadas = 0;

  for (const user of conductores) {
    const vehiculo = user.assignedVehicle;
    if (!vehiculo) continue;
    const monto = vehiculo.tarifaDiaria || 70000;

    const yaExiste = await Deuda.findOne({
      usuario: user._id,
      vehiculo: vehiculo._id,
      fecha: { $gte: inicioDia, $lte: finDia }, // <-- esto es clave!
    });

    if (!yaExiste) {
      await Deuda.create({
        usuario: user._id,
        vehiculo: vehiculo._id,
        fecha: inicioDia, // o fechaSoloDia
        monto,
        pagada: false,
        metodo: "manual",
        estado: "creada",
      });
      creadas++;
      console.log(`✅ Deuda creada para ${user.username} (${vehiculo.placa})`);
    } else {
      console.log(`ℹ️ Ya existe deuda para ${user.username} el ${inicioDia.toLocaleDateString()}`);
    }
  }
  res.json({ message: `Deudas generadas: ${creadas}` });
});


export default router;
