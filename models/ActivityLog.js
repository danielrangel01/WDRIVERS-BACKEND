
import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tipo: { type: String, enum: ['pago', 'gasto', 'usuario', 'login', 'aprobacion pago', 'Creacion de usuario', 'pago deuda', 'Deuda generada', ], required: true },
  descripcion: { type: String, required: true },
  fecha: { type: Date, default: Date.now }
});

export default mongoose.model('ActivityLog', activitySchema);