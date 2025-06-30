router.post("/cron-generar-deudas", async (req, res) => {
  const cronSecret = req.headers["x-cron-secret"];
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: "No autorizado" });
  }

  const conductores = await User.find({ role: "conductor" }).populate("assignedVehicle");
  const fechaHoy = new Date();
  const inicioDia = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), fechaHoy.getDate());
  const finDia = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), fechaHoy.getDate(), 23, 59, 59, 999);

  let creadas = 0;

  for (const user of conductores) {
    const vehiculo = user.assignedVehicle;
    if (!vehiculo) continue;
    const monto = vehiculo.tarifaDiaria || 70000;

    // 1. ¿Ya existe un pago de este conductor para este vehículo hoy?
    const yaPago = await Pago.findOne({
      usuario: user._id,
      vehiculo: vehiculo._id,
      fecha: { $gte: inicioDia, $lte: finDia }
    });

    if (yaPago) {
      // Ya pagó, NO crear deuda
      console.log(`✔️ El conductor ${user.username} (${vehiculo.placa}) ya pagó el día ${inicioDia.toLocaleDateString()}`);
      continue;
    }

    // 2. ¿Ya existe deuda creada hoy? (opcional: puedes omitir si seguro NO habrá duplicados)
    const yaExisteDeuda = await Deuda.findOne({
      usuario: user._id,
      vehiculo: vehiculo._id,
      fecha: { $gte: inicioDia, $lte: finDia }
    });

    if (yaExisteDeuda) {
      console.log(`ℹ️ Ya existe deuda para ${user.username} el ${inicioDia.toLocaleDateString()}`);
      continue;
    }

    // 3. Crear deuda
    await Deuda.create({
      usuario: user._id,
      vehiculo: vehiculo._id,
      fecha: inicioDia,
      monto,
      pagada: false,
      metodo: "manual",
      estado: "creada",
    });
    creadas++;
    console.log(`✅ Deuda creada para ${user.username} (${vehiculo.placa})`);
  }

  res.json({ message: `Deudas generadas: ${creadas}` });
});
