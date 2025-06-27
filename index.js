import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import path from "path";
import fs from "fs";
import paymentRoutes from "./routes/paymentRoutes.js";
import cron from "node-cron";
import { exec } from "child_process";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import conductorRoutes from "./routes/conductorRoutes.js";
import solicitudesRoutes from "./routes/solicitudesRoutes.js";
import Deuda from "./models/Deuda.js";

dotenv.config();
const app = express();

/* cron.schedule("0 2 * * *", () => {
  console.log("🕒 Ejecutando cronjob diario para generar deudas...");
  exec("node cron/generarDeudas.js", (err, stdout, stderr) => {
    if (err) console.error("❌ Error:", err);
    else console.log(stdout);
  });
}); */

// Middleware para el webhook de Wompi (raw body)
app.use("/api/pagos/webhook", express.raw({ type: "application/json" }));

// Middleware general JSON
app.use(express.json());

// CORS
const whitelist = [
  "http://localhost:3000",
  "https://tuapp.com",
  "http://192.168.56.1:3000",
  "http://192.168.1.11:3000",
  "http://192.168.0.37:3000",
  "http://192.168.1.15:3000",
  "https://wdrivers.co",
  "http://wdrivers.co",
  "https://cozy-elf-edd2b5.netlify.app",




  
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("No permitido por CORS"));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Rutas
app.use("/api/login", authRoutes);
app.use("/api/usuarios", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/actividad", activityRoutes);
app.use("/api/pagos", paymentRoutes); // Ya contiene el webhook
app.use("/api/gastos", expenseRoutes);
app.use("/api/reportes", reportRoutes);
app.use("/api/vehiculos", vehicleRoutes);
app.use("/api/conductor", conductorRoutes);
app.use("/api/solicitudes", solicitudesRoutes);
app.use("/uploads", express.static(path.resolve("uploads")));

async function crearAdminInicial() {
  const username = "admin";
  const password = "admin123"; // Cámbialo después de iniciar

  // ¿Ya existe?
  const existente = await User.findOne({ username });
  if (!existente) {
    const hashed = await bcrypt.hash(password, 10);
    const admin = new User({
      username,
      password: hashed,
      role: "admin",
    });
    await admin.save();
    console.log("✅ Usuario admin inicial creado:", username, password);
  } else {
    console.log("ℹ️ Usuario admin ya existe");
  }
}

// MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("✅ MongoDB conectado");
    crearAdminInicial();
    /* // ⚠️ Lógica temporal para insertar deudas de ejemplo
    const conductores = await User.find({ role: "conductor" }).populate(
      "assignedVehicle"
    );

    const fechaHoy = new Date();
    const fechaSoloDia = new Date(
      fechaHoy.getFullYear(),
      fechaHoy.getMonth(),
      fechaHoy.getDate()
    );

    for (const user of conductores) {
      if (!user.assignedVehicle) continue;

      const yaExiste = await Deuda.findOne({
        usuario: user._id,
        fecha: fechaSoloDia,
      });

      if (!yaExiste) {
        await Deuda.create({
          usuario: user._id,
          vehiculo: user.assignedVehicle._id,
          fecha: fechaSoloDia,
          monto: 70000,
          pagada: false,
        });

        console.log(`✅ Deuda creada para ${user.username}`);
      } else {
        console.log(`ℹ️ Ya existe deuda para ${user.username} hoy`);
      }
    }  */

    // Crear deudas a todos los conductores con vehículo asignado
/*     async function crearDeudasMasivas({ monto = 70000, fecha = new Date() }) {
      const fechaSoloDia = new Date(
        fecha.getFullYear(),
        fecha.getMonth(),
        fecha.getDate()
      );
      const conductores = await User.find({ role: "conductor" }).populate(
        "assignedVehicle"
      );

      let creadas = 0;
      for (const user of conductores) {
        if (!user.assignedVehicle) continue;

        // Evitar duplicados para el mismo día
        const yaExiste = await Deuda.findOne({
          usuario: user._id,
          vehiculo: user.assignedVehicle._id,
          fecha: fechaSoloDia,
        });
        if (yaExiste) {
          console.log(
            `ℹ️ Ya existe deuda para ${
              user.username
            } el ${fechaSoloDia.toLocaleDateString()}`
          );
          continue;
        }

        await Deuda.create({
          usuario: user._id,
          vehiculo: user.assignedVehicle._id,
          monto,
          fecha: fechaSoloDia,
          pagada: false,
          metodo: "manual",
          estado: "creada",
        });
        creadas++;
        console.log(
          `✅ Deuda creada para ${user.username} (${user.assignedVehicle.placa}) por $${monto}`
        );
      }
      if (creadas === 0) {
        console.log("No se crearon nuevas deudas.");
      } else {
        console.log(
          `🔔 ${creadas} deudas creadas para el día ${fechaSoloDia.toLocaleDateString()}`
        );
      }
    } */

    //Llama a la función así (descomenta para ejecutar una vez)
  // crearDeudasMasivas({ monto: 70000, fecha: new Date("2025-06-26") }); // Cambia fecha si quieres simular otro día

    app.listen(process.env.PORT || 4000, "0.0.0.0", () => {
      console.log(`🚀 Servidor en puerto ${process.env.PORT || 4000}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error al conectar a MongoDB:", err);
  });
