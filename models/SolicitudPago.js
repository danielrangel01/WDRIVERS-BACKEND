import mongoose from 'mongoose';

const solicitudPagoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehiculo: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  monto: { type: Number, required: true },
  evidencia: { type: String },
  estado: { type: String, enum: ['pendiente', 'aprobado', 'rechazado'], default: 'pendiente' },
  referencia: String,
  fecha: { type: Date, default: Date.now }
});

export default mongoose.model('SolicitudPago', solicitudPagoSchema);
