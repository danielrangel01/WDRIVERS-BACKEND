// routes/auth.js
import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { registrarActividad } from "../utils/logActivity.js";

dotenv.config();

const router = express.Router();

router.post("/", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.status(401).json({ message: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    try {
      await registrarActividad({
        usuarioId: user._id,
        tipo: "login",
        descripcion: "Inició sesión en el sistema",
      });
    } catch (error) {
      console.error("❌ No se pudo registrar actividad:", error.message);
    }

    res.json({
      token,
      userId: user._id,
      username: user.username,
      role: user.role,
    });
  } catch {
    res.status(500).json({ message: "Error en el login" });
  }
});

export default router;
