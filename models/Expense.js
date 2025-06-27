import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  monto: {
    type: Number,
    required: true
  },
  descripcion: {
    type: String,
    required: true
  },
  vehiculo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle', 
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Expense', expenseSchema);
