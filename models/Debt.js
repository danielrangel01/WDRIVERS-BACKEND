// backend/models/Debt.js
import mongoose from 'mongoose';

const debtSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vehiculo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  fecha: {
    type: Date,
    required: true
  },
  monto: {
    type: Number,
    required: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'pagado'],
    default: 'pendiente'
  }
});

export default mongoose.model('Debt', debtSchema);
