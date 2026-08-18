/* =========================================================
   ASIGNACION AUTOMATICA V10
   - ZENDESK + DYNAMIC: automaticos
   - PORTAL: conserva su flujo actual
   - Modulo aditivo: no reemplaza funciones existentes
========================================================= */

const ASIGNACION_V10_ORIGENES = ['ZENDESK', 'DYNAMIC'];
const ASIGNACION_V10_TRIGGER_FUNC = 'procesarAsignacionAutomaticaCanalesSistemaV10';

function obtenerPendientesAsignacionCanalesV10_() {
  return leerTicketsBase()
    .tickets
    .filter(ticket =>
      ASIGNACION_V10_ORIGENES.includes(
        normalizar(ticket.origen)
      ) &&
      !limpiar(ticket.responsable) &&
      esTicketActivoParaCarga_(ticket)
    );
}

function asignarTicketCanalInternoV10_(
  numero,
  asesor,
  usuarioEjecutor
) {
  const base = leerTicketsBase();

  const ticket = base.tickets.find(item =>
    String(item.numero) === String(numero)
  );

  if (!ticket) {
    throw new Error('No se encontro el ticket');
  }

  const origen = normalizar(ticket.origen);

  if (!ASIGNACION_V10_ORIGENES.includes(origen)) {
    throw new Error(
      'Este ticket no corresponde a Zendesk ni Dynamic'
    );
  }

  if (limpiar(ticket.responsable)) {
    throw new Error('El ticket ya tiene responsable');
  }

  escribirPorEncabezado_(
    base.hoja,
    base.mapa,
    ticket.rowNumber,
    'Responsable',
    asesor
  );

  if (!limpiar(ticket.tiempoInicio)) {
    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'TIEMPO INICIO',
      new Date()
    );
  }

  escribirPorEncabezado_(
    base.hoja,
    base.mapa,
    ticket.rowNumber,
    'FECHA ACTUALIZACION',
    new Date()
  );

  escribirPorEncabezado_(
    base.hoja,
    base.mapa,
    ticket.rowNumber,
    'USUARIO ULTIMA MODIFICACION',
    usuarioEjecutor
  );

  actualizarUltimaAsignacionUsuario(asesor);

  registrarAsignacionRotativa(
    ticket,
    asesor,
    usuarioEjecutor,
    origen,
    `Asignacion automatica de ticket ${origen}`
  );

  SpreadsheetApp.flush();

  return {
    numero: ticket.numero,
    ticket: ticket.ticket,
    alumno: ticket.alumno,
    origen,
    asesor
  };
}

function procesarAsignacionAutomaticaCanalesCoreV10_(
  usuarioEjecutor
) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const pendientes = obtenerPendientesAsignacionCanalesV10_();
    const asignados = [];
    const errores = [];

    pendientes.forEach(ticket => {
      try {
        const recomendado = seleccionarSiguienteAsesor();

        if (!recomendado) {
          throw new Error('No hay asesor disponible');
        }

        const asignado = asignarTicketCanalInternoV10_(
          ticket.numero,
          recomendado.asesor,
          usuarioEjecutor || 'SISTEMA'
        );

        asignados.push(asignado);

      } catch (error) {
        errores.push({
          numero: ticket.numero,
          ticket: ticket.ticket,
          origen: ticket.origen,
          message: error.message
        });
      }
    });

    return {
      ok: true,
      asignados: asignados,
      totalAsignados: asignados.length,
      errores: errores,
      message:
        asignados.length
          ? `${asignados.length} ticket(s) asignado(s) automaticamente`
          : 'No hay tickets Zendesk o Dynamic pendientes'
    };

  } catch (error) {
    return {
      ok: false,
      message: error.message
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (error) {}
  }
}

function procesarAsignacionAutomaticaCanalesV10(token) {
  const validacion = validarAdmin(token);

  if (!validacion.ok) {
    return validacion;
  }

  return procesarAsignacionAutomaticaCanalesCoreV10_(
    validacion.sesion.usuario
  );
}

function procesarAsignacionAutomaticaCanalesSistemaV10() {
  return procesarAsignacionAutomaticaCanalesCoreV10_(
    'SISTEMA_AUTO'
  );
}

function asegurarAsignacionAutomaticaV10(token) {
  try {
    const validacion = validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const existe = ScriptApp
      .getProjectTriggers()
      .some(trigger =>
        trigger.getHandlerFunction() ===
        ASIGNACION_V10_TRIGGER_FUNC
      );

    if (!existe) {
      ScriptApp
        .newTrigger(
          ASIGNACION_V10_TRIGGER_FUNC
        )
        .timeBased()
        .everyMinutes(1)
        .create();
    }

    return {
      ok: true,
      triggerInstalado: !existe,
      message:
        existe
          ? 'Asignacion automatica ya estaba activa'
          : 'Asignacion automatica activada cada minuto'
    };

  } catch (error) {
    return {
      ok: false,
      message: error.message
    };
  }
}

function obtenerNotificacionesAsignacionV10(
  token,
  despuesDeMs
) {
  try {
    const validacion = validarSesion(token);

    if (!validacion.ok) {
      return validacion;
    }

    const sesion = validacion.sesion;

    if (sesion.rol === 'ADMIN') {
      return {
        ok: true,
        notificaciones: [],
        ahoraMs: Date.now()
      };
    }

    const asesor = limpiar(
      sesion.responsableAsignado
    );

    if (!asesor) {
      return {
        ok: true,
        notificaciones: [],
        ahoraMs: Date.now()
      };
    }

    const hoja = obtenerOCrearHojaHistorialAsignaciones_();

    if (hoja.getLastRow() < 2) {
      return {
        ok: true,
        notificaciones: [],
        ahoraMs: Date.now()
      };
    }

    const ultimaFila = hoja.getLastRow();
    const cantidad = Math.min(120, ultimaFila - 1);
    const filaInicio = ultimaFila - cantidad + 1;

    const valores = hoja
      .getRange(
        filaInicio,
        1,
        cantidad,
        Math.min(8, hoja.getLastColumn())
      )
      .getValues();

    const limite = Number(despuesDeMs || 0);
    const notificaciones = [];

    valores.forEach(fila => {
      const fecha = parsearFechaFlexible(fila[0]);
      const fechaMs = fecha ? fecha.getTime() : 0;
      const asesorFila = limpiar(fila[4]);
      const origen = normalizar(fila[3]);

      if (
        fechaMs > limite &&
        normalizar(asesorFila) === normalizar(asesor) &&
        ASIGNACION_V10_ORIGENES.includes(origen)
      ) {
        notificaciones.push({
          fechaMs,
          numero: limpiar(fila[1]),
          ticket: limpiar(fila[2]),
          origen,
          asesor: asesorFila,
          tipo: limpiar(fila[6]),
          observacion: limpiar(fila[7])
        });
      }
    });

    notificaciones.sort(
      (a, b) => a.fechaMs - b.fechaMs
    );

    return {
      ok: true,
      asesor,
      notificaciones,
      ahoraMs: Date.now()
    };

  } catch (error) {
    return {
      ok: false,
      message: error.message,
      notificaciones: [],
      ahoraMs: Date.now()
    };
  }
}
