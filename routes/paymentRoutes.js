import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import SolicitudPago from "../models/SolicitudPago.js";
import Pago from "../models/Pago.js";
import User from "../models/User.js";
import Deuda from "../models/Deuda.js";
import { registrarActividad } from "../utils/logActivity.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// Definir tamaño máximo en bytes (por ejemplo, 2 MB)
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

// Sólo extensiones permitidas
const allowedTypes = /jpeg|jpg|png|webp/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads/comprobantes";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `comprobante-${Date.now()}${ext}`);
  },
});

// Filtro para tipos de archivo
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes (jpeg, jpg, png, webp)"));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

router.post("/", authMiddleware, requireRole("conductor"), async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId).populate("assignedVehicle");

  const pago = await Pago.create({
    vehiculo: user.assignedVehicle,
    usuario: user._id,
    monto: req.body.monto,
  });

  // Marcar deudas como pagadas si hay
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const deuda = await Deuda.findOne({ usuario: user._id, fecha: hoy });
  if (deuda && !deuda.pagado) {
    deuda.pagado = true;
    await deuda.save();
  }

  await registrarActividad({
    usuarioId: userId,
    tipo: "pago",
    descripcion: `Pago de $${req.body.monto}`,
  });

  res.status(201).json(pago);
});

router.post(
  "/pagos-manual",
  authMiddleware,
  upload.single("comprobante"),
  async (req, res) => {
    try {
      const { monto } = req.body;
      if (!monto) return res.status(400).json({ message: "Monto requerido" });

      const archivo = req.file;
      const usuario = await User.findById(req.userId).populate("assignedVehicle");

      if (!archivo)
        return res.status(400).json({ message: "Comprobante requerido" });
      if (!usuario || !usuario.assignedVehicle)
        return res.status(400).json({ message: "Sin vehículo asignado" });

      const referencia = `MANUAL-${Date.now()}-${usuario._id}`;

      await SolicitudPago.create({
        usuario: usuario._id,
        vehiculo: usuario.assignedVehicle._id,
        monto: Number(monto),
        estado: "pendiente",
        referencia,
        evidencia: archivo.path,
      });

      res
        .status(201)
        .json({ message: "Pago pendiente con comprobante registrado" });
    } catch (err) {
      // 🚩 Robustecer manejo de error de multer:
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "El archivo excede el tamaño máximo de 2 MB" });
        }
      }
      if (err.message && err.message.includes("Solo se permiten imágenes")) {
        return res.status(400).json({ message: err.message });
      }
      console.error(err);
      res.status(500).json({ message: "Error al registrar el pago manual" });
    }
  }
);

router.get("/mis-pagos", authMiddleware, async (req, res) => {
  try {
    const { mes, año } = req.query;

    const filtro = { usuario: req.userId };

    if (mes && año) {
      const inicio = new Date(año, mes - 1, 1);
      const fin = new Date(año, mes, 0, 23, 59, 59);
      filtro.fecha = { $gte: inicio, $lte: fin };
    }

    const pagos = await Pago.find(filtro)
      .populate("vehiculo")
      .sort({ fecha: -1 });

    res.json(pagos);
  } catch {
    res.status(500).json({ message: "Error al obtener historial de pagos" });
  }
});



// GET /api/pagos/deudas (conductor)
router.get(
  "/deudas",
  authMiddleware,
  requireRole("conductor"),
  async (req, res) => {
    const deudas = await Deuda.find({
      usuario: req.userId,
      pagada: false,
      estado: { $in: ["pendiente", "creada"] },
      eliminada: { $ne: true }, 
    }).populate("vehiculo");
    res.json(deudas);
  }
);

router.post(
  "/solicitudes/:id/rechazar",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const { motivo } = req.body;
    const solicitud = await SolicitudPago.findById(req.params.id);
    if (!solicitud || solicitud.estado !== "pendiente")
      return res.status(404).json({ message: "Solicitud no encontrada o no pendiente" });

    solicitud.estado = "rechazado";
    solicitud.motivoRechazo = motivo || "Sin motivo";
    await solicitud.save();

    await registrarActividad({
      usuarioId: req.userId,
      tipo: "rechazo pago manual",
      descripcion: `Rechazó pago manual ${solicitud.referencia}. Motivo: ${motivo}`,
    });

    res.json({ message: "Pago rechazado" });
  }
);

// POST /api/pagos/deudas/:id/rechazar
router.post(
  "/pagos/deudas/:id/rechazar",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const { motivo } = req.body;
    const deuda = await Deuda.findById(req.params.id);
    if (
      !deuda ||
      deuda.pagada ||
      deuda.estado !== "pendiente" ||
      deuda.metodo !== "manual"
    )
      return res.status(404).json({ message: "Deuda no válida o ya procesada" });

    deuda.estado = "rechazado";
    deuda.motivoRechazo = motivo || "Sin motivo";
    await deuda.save();

    await registrarActividad({
      usuarioId: req.userId,
      tipo: "rechazo deuda",
      descripcion: `Rechazó pago de deuda ref: ${deuda._id}. Motivo: ${motivo}`,
    });

    res.json({ message: "Pago de deuda rechazado" });
  }
);

router.get("/mis-rechazados", authMiddleware, requireRole("conductor"), async (req, res) => {
  // Pagos RECHAZADOS en SolicitudPago (pagos manuales rechazados)
  const solicitudes = await SolicitudPago.find({
    usuario: req.userId,
    estado: "rechazado",
  })
    .populate("vehiculo")
    .sort({ fecha: -1 });

  // Deudas RECHAZADAS manuales (si guardas estado "rechazado" en deuda)
  const deudas = await Deuda.find({
    usuario: req.userId,
    estado: "rechazado",
  })
    .populate("vehiculo")
    .sort({ fecha: -1 });

  // Unificamos
  const rechazados = [
    ...solicitudes.map((s) => ({
      _id: s._id,
      monto: s.monto,
      vehiculo: s.vehiculo,
      fecha: s.fecha || s.createdAt,
      motivoRechazo: s.motivoRechazo,
    })),
    ...deudas.map((d) => ({
      _id: d._id,
      monto: d.monto,
      vehiculo: d.vehiculo,
      fecha: d.fecha,
      motivoRechazo: d.motivoRechazo,
    })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  res.json(rechazados);
});



// GET /api/pagos/deudas-admin (admin) — todas, NO eliminadas
router.get(
  "/deudas-admin",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const deudas = await Deuda.find({
      eliminada: { $ne: true }
    })
      .populate("vehiculo usuario")
      .sort({ fecha: -1 });
    res.json(deudas);
  }
);

// PUT /api/pagos/deuda/:id — editar monto
router.put(
  "/deuda/:id",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const { id } = req.params;
    const { monto } = req.body;
    const deuda = await Deuda.findById(id);
    if (!deuda) return res.status(404).json({ message: "Deuda no encontrada" });
    if (deuda.pagada) return res.status(400).json({ message: "Ya pagada" });
    if (deuda.eliminada) return res.status(400).json({ message: "Ya eliminada" });

    deuda.monto = monto;
    await deuda.save();

    await registrarActividad({
      usuarioId: req.userId,
      tipo: "editar deuda",
      descripcion: `Editó deuda ref: ${deuda._id} a $${monto}`,
    });

    res.json({ message: "Monto de deuda actualizado" });
  }
);

// DELETE /api/pagos/deuda/:id — eliminar con motivo
router.delete(
  "/deuda/:id",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo || motivo.length < 3) {
      return res.status(400).json({ message: "Debes indicar un motivo válido." });
    }

    const deuda = await Deuda.findById(id);
    if (!deuda) return res.status(404).json({ message: "Deuda no encontrada" });

    deuda.motivoEliminacion = motivo;
    deuda.eliminada = true;
    await deuda.save();

    await registrarActividad({
      usuarioId: req.userId,
      tipo: "eliminacion deuda",
      descripcion: `Eliminó deuda ref: ${deuda._id} por $${deuda.monto} el ${deuda.fecha.toLocaleDateString()} - Motivo: ${motivo}`,
    });

    res.json({ message: "Deuda marcada como eliminada", motivo });
  }
);

router.post(
  "/pagar-deuda/:id",
  authMiddleware,
  requireRole("conductor"),
  upload.single("comprobante"),
  async (req, res) => {
    try {
      const deuda = await Deuda.findById(req.params.id).populate(
        "vehiculo usuario"
      );
      if (!deuda || deuda.pagada)
        return res.status(404).json({ message: "Deuda no válida o ya pagada" });
      if (deuda.usuario._id.toString() !== req.userId.toString())
        return res.status(403).json({ message: "No tienes permiso" });

      const { metodo } = req.body;

      if (metodo === "pse") {
        // Lógica para PSE (Wompi)
        const referencia = `DEUDA-${deuda._id}`;
        deuda.metodo = "pse";
        deuda.referencia = referencia;
        await deuda.save();

        const checkoutUrl = `https://checkout.wompi.co/p/?public-key=${
          process.env.PUBLIC_KEY_WOMPI
        }&currency=COP&amount-in-cents=${
          deuda.monto * 100
        }&reference=${referencia}&redirect-url=http://localhost:3000/pago-exitoso`;
        return res.json({ checkoutUrl });
      }

      // Si es manual
      if (!req.file)
        return res.status(400).json({ message: "Comprobante requerido" });
      deuda.comprobante = req.file.path;
      deuda.metodo = "manual";
      deuda.estado = "pendiente";
      await deuda.save();

      res.json({
        message: "Pago manual registrado. Espera aprobación del admin.",
      });
    } catch (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "El archivo excede el tamaño máximo de 2 MB" });
        }
      }
      if (err.message && err.message.includes("Solo se permiten imágenes")) {
        return res.status(400).json({ message: err.message });
      }
      console.error(err);
      res.status(500).json({ message: "Error al procesar el pago de la deuda" });
    }
  }
);

router.post(
  "/deudas/:id/aprobar",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const deuda = await Deuda.findById(req.params.id).populate(
      "usuario vehiculo"
    );
    if (
      !deuda ||
      deuda.pagada ||
      deuda.estado !== "pendiente" ||
      deuda.metodo !== "manual"
    )
      return res.status(404).json({ message: "Deuda no válida o ya aprobada" });

    // Registrar el pago
    const pago = await Pago.create({
      monto: deuda.monto,
      vehiculo: deuda.vehiculo._id,
      usuario: deuda.usuario._id,
      fecha: new Date(),
    });

    deuda.pagada = true;
    deuda.estado = "aprobada";
    deuda.fechaPago = new Date();
    deuda.pagoId = pago._id;
    await deuda.save();

    res.json({ message: "Pago de deuda aprobado" });
  }
);

// Mostrar deudas manuales pendientes para admin (en paymentRoutes.js)
// GET /api/pagos/deudas-pendientes
router.get(
  "/deudas-pendientes",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const deudas = await Deuda.find({
      metodo: "manual",
      pagada: false,
      estado: "pendiente" ,
      comprobante: { $exists: true, $ne: null },
      eliminada: { $ne: true },
    }).populate("usuario vehiculo");
    res.json(deudas);
  }
);

// POST /api/pagos/webhook-wompi (ajusta el endpoint como tengas)
router.post(
  "/webhook-wompi",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    // ...verificación de firma como ya tienes
    const evento = JSON.parse(req.body.toString());
    if (
      evento.event === "transaction.updated" &&
      evento.data.status === "APPROVED"
    ) {
      const referencia = evento.data.reference;
      const deuda = await Deuda.findOne({ referencia, pagada: false });
      if (deuda) {
        deuda.pagada = true;
        deuda.estado = "aprobada";
        deuda.fechaPago = new Date();
        await deuda.save();
        // Puedes registrar también el pago real en Pago
      }
    }
    res.sendStatus(200);
  }
);

export default router;
