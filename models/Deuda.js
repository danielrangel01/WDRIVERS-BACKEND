import mongoose from 'mongoose';

const deudaSchema = new mongoose.Schema({
  usuario:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehiculo:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  fecha:      { type: Date, required: true }, // Día de la deuda
  monto:      { type: Number, required: true },

  pagada:     { type: Boolean, default: false },

  metodo:     { type: String, enum: ['manual', 'pse'], default: 'manual' }, // Cómo se paga la deuda
  comprobante:{ type: String }, // Ruta del archivo comprobante si es manual
  referencia: { type: String }, // Referencia para pagos PSE (útil para Wompi)
  estado:     { type: String, enum: ['creada', 'pendiente', 'aprobada'], default: 'creada' }, // Para flujo de aprobación manual o PSE
  fechaPago:  { type: Date }, // Cuándo se pagó la deuda (cuando se aprueba)

  pagoId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Pago' },// Relación al pago registrado (si aplica)
  motivoEliminacion: { type: String },
  eliminada: { type: Boolean, default: false }
},
{
  timestamps: true
});

export default mongoose.model('Deuda', deudaSchema);
