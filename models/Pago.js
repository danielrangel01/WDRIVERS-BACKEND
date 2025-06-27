import mongoose from "mongoose";

const pagoSchema = new mongoose.Schema({
  monto: Number,
  fecha: {
    type: Date,
    required: true,
    default: Date.now,
  },
  vehiculo: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

export default mongoose.model("Pago", pagoSchema);
