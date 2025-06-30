// backend/routes/cronRoutes.js
import express from "express";
import User from "../models/User.js";
import Deuda from "../models/Deuda.js";
import { registrarActividad } from "../utils/logActivity.js";

//

const router = express.Router();

router.post("/cron-generar-deudas", async (req, res) => {
  const cronSecret = req.headers["x-cron-secret"];
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: "No autorizado" });
  }

  const conductores = await User.find({ role: "conductor" }).populate("assignedVehicle");
  const fechaHoy = new Date();
  const fechaSoloDia = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), fechaHoy.getDate());

  let creadas = 0;

  for (const user of conductores) {
    const vehiculo = user.assignedVehicle;
    if (!vehiculo) continue;

    // Usa la tarifa diaria del vehículo asignado
    const monto = vehiculo.tarifaDiaria || 70000; // fallback si no hay tarifa

    const yaExiste = await Deuda.findOne({
      usuario: user._id,
      vehiculo: vehiculo._id,
      fecha: fechaSoloDia,
    });

    if (!yaExiste) {
      await Deuda.create({
        usuario: user._id,
        vehiculo: vehiculo._id,
        fecha: fechaSoloDia,
        monto,
        pagada: false,
        metodo: "manual",
        estado: "creada",
      });

      await registrarActividad({
        usuarioId: user._id,
        tipo: "deuda",
        descripcion: `El sistema generó deuda de $${monto} para ${user.username} (${vehiculo.placa})`,
      });

      creadas++;
    }
  }
  res.json({ message: `Deudas generadas: ${creadas}` });
});

export default router;
