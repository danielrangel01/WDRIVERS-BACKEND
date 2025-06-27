import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  placa: { type: String, required: true },
  modelo: { type: String, required: true },
  tipo: { type: String, required: true },
  tarifaDiaria: { type: Number, required: true },
}, { timestamps: true });

export default mongoose.model('Vehicle', vehicleSchema);
