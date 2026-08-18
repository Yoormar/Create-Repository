/* =========================================================
   ASIGNACION DIRECTA V11
   Archivo independiente. NO pegar HTML/CSS aqui.
   Automatiza solo ZENDESK + DYNAMIC.
   PORTAL conserva su flujo actual.
========================================================= */

const ASIGNACION_DIRECTA_V11_ORIGENES = [
  'ZENDESK',
  'DYNAMIC'
];

const ASIGNACION_DIRECTA_V11_TRIGGER =
  'procesarPendientesDirectoSistemaV11';

function obtenerPendientesDirectoV11(token) {
  try {
    const validacion = validarAdmin(token);
    if (!validacion.ok) return validacion;

    const pendientes = leerTicketsBase().tickets.filter(ticket =>
      ASIGNACION_DIRECTA_V11_ORIGENES.includes(normalizar(ticket.origen)) &&
      !limpiar(ticket.responsable) &&
      esTicketActivoParaCarga_(ticket)
    );

    return {
      ok: true,
      total: pendientes.length,
      zendesk: pendientes.filter(ticket => normalizar(ticket.origen) === 'ZENDESK').length,
      dynamic: pendientes.filter(ticket => normalizar(ticket.origen) === 'DYNAMIC').length
    };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function asignarTicketDirectoV11_(numero, asesor, usuarioEjecutor) {
  const base = leerTicketsBase();
  const ticket = base.tickets.find(item => String(item.numero) === String(numero));

  if (!ticket) throw new Error('No se encontró el ticket');

  const origen = normalizar(ticket.origen);

  if (!ASIGNACION_DIRECTA_V11_ORIGENES.includes(origen)) {
    throw new Error('El ticket no es Zendesk ni Dynamic');
  }

  if (limpiar(ticket.responsable)) {
    throw new Error('El ticket ya tiene responsable');
  }

  if (!esTicketActivoParaCarga_(ticket)) {
    throw new Error('El ticket ya no está activo');
  }

  const ahora = new Date();

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
      ahora
    );
  }

  escribirPorEncabezado_(
    base.hoja,
    base.mapa,
    ticket.rowNumber,
    'FECHA ACTUALIZACIÓN',
    ahora
  );

  escribirPorEncabezado_(
    base.hoja,
    base.mapa,
    ticket.rowNumber,
    'USUARIO ÚLTIMA MODIFICACIÓN',
    usuarioEjecutor
  );

  actualizarUltimaAsignacionUsuario(asesor);

  registrarAsignacionRotativa(
    ticket,
    asesor,
    usuarioEjecutor,
    origen,
    `Asignación automática ${origen}`
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

function procesarPendientesDirectoCoreV11_(usuarioEjecutor) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const pendientes = leerTicketsBase().tickets
      .filter(ticket =>
        ASIGNACION_DIRECTA_V11_ORIGENES.includes(normalizar(ticket.origen)) &&
        !limpiar(ticket.responsable) &&
        esTicketActivoParaCarga_(ticket)
      )
      .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));

    const asignados = [];
    const errores = [];

    for (const pendiente of pendientes) {
      try {
        const recomendado = seleccionarSiguienteAsesor();

        if (!recomendado) {
          errores.push({
            numero: pendiente.numero,
            ticket: pendiente.ticket,
            origen: pendiente.origen,
            message: 'No hay asesor disponible'
          });
          break;
        }

        asignados.push(
          asignarTicketDirectoV11_(
            pendiente.numero,
            recomendado.asesor,
            usuarioEjecutor || 'SISTEMA_AUTO'
          )
        );
      } catch (error) {
        errores.push({
          numero: pendiente.numero,
          ticket: pendiente.ticket,
          origen: pendiente.origen,
          message: error.message
        });
      }
    }

    const restantes = leerTicketsBase().tickets.filter(ticket =>
      ASIGNACION_DIRECTA_V11_ORIGENES.includes(normalizar(ticket.origen)) &&
      !limpiar(ticket.responsable) &&
      esTicketActivoParaCarga_(ticket)
    );

    let message = 'No existen pendientes Zendesk o Dynamic';

    if (asignados.length) {
      message = `${asignados.length} ticket(s) asignado(s) correctamente`;
    } else if (errores.length) {
      message = `No se asignó. ${errores[0].message}`;
    }

    return {
      ok: true,
      encontrados: pendientes.length,
      totalAsignados: asignados.length,
      asignados,
      restantes: restantes.length,
      errores,
      message
    };
  } catch (error) {
    return { ok: false, message: error.message };
  } finally {
    try { lock.releaseLock(); } catch (error) {}
  }
}

function procesarPendientesDirectoV11(token) {
  const validacion = validarAdmin(token);
  if (!validacion.ok) return validacion;

  return procesarPendientesDirectoCoreV11_(
    validacion.sesion.usuario
  );
}

function procesarPendientesDirectoSistemaV11() {
  return procesarPendientesDirectoCoreV11_('SISTEMA_AUTO');
}

function asegurarAsignacionDirectaV11(token) {
  try {
    const validacion = validarAdmin(token);
    if (!validacion.ok) return validacion;

    const existe = ScriptApp.getProjectTriggers().some(trigger =>
      trigger.getHandlerFunction() === ASIGNACION_DIRECTA_V11_TRIGGER
    );

    if (!existe) {
      ScriptApp.newTrigger(ASIGNACION_DIRECTA_V11_TRIGGER)
        .timeBased()
        .everyMinutes(1)
        .create();
    }

    return {
      ok: true,
      instalado: !existe,
      message: existe
        ? 'Automático ya activo'
        : 'Automático activado cada minuto'
    };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function obtenerNotificacionesAsignacionV11(token, despuesDeMs) {
  try {
    const validacion = validarSesion(token);
    if (!validacion.ok) return validacion;

    const sesion = validacion.sesion;

    if (sesion.rol === 'ADMIN') {
      return { ok: true, notificaciones: [], ahoraMs: Date.now() };
    }

    const asesor = limpiar(sesion.responsableAsignado);

    if (!asesor) {
      return { ok: true, notificaciones: [], ahoraMs: Date.now() };
    }

    const hoja = obtenerOCrearHojaHistorialAsignaciones_();

    if (hoja.getLastRow() < 2) {
      return { ok: true, notificaciones: [], ahoraMs: Date.now() };
    }

    const ultimaFila = hoja.getLastRow();
    const cantidad = Math.min(150, ultimaFila - 1);
    const inicio = ultimaFila - cantidad + 1;

    const valores = hoja
      .getRange(
        inicio,
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
      const origen = normalizar(fila[3]);
      const asesorFila = limpiar(fila[4]);

      if (
        fechaMs > limite &&
        normalizar(asesorFila) === normalizar(asesor) &&
        ASIGNACION_DIRECTA_V11_ORIGENES.includes(origen)
      ) {
        notificaciones.push({
          fechaMs,
          numero: limpiar(fila[1]),
          ticket: limpiar(fila[2]),
          origen,
          asesor: asesorFila
        });
      }
    });

    notificaciones.sort((a, b) => a.fechaMs - b.fechaMs);

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
