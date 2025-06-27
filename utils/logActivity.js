import ActivityLog from '../models/ActivityLog.js';

export const registrarActividad = async ({ usuarioId, tipo, descripcion }) => {
  await ActivityLog.create({ usuario: usuarioId, tipo, descripcion });
};