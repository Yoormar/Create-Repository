/* =========================================================
   SISTEMA OPERATIVO V12.5
   - Prioridad diaria segun regla definida para BASE_TICKETS
   - ATENDIDO cuenta por FECHA FIN del dia actual
   - Otros estados operativos cuentan por FECHA INICIO del dia actual
   - DERIVADO y CERRADO no cuentan
   - ESTADO TICKET CERRADO tampoco cuenta como recibido
   - SEGUIMIENTO no suma prioridad, solo informa disponibilidad
   - Usa BASE_TICKETS como fuente unica del conteo diario
   - Orden de asignacion: menor prioridad diaria primero
   - Asignacion automatica ZENDESK + DYNAMIC
   - Dashboard superior sincronizado
========================================================= */

const V12_ORIGENES_AUTOMATICOS = ['ZENDESK', 'DYNAMIC'];
const V12_ORIGENES_DASHBOARD = ['ZENDESK', 'PORTAL', 'DYNAMIC'];
const V12_VERSION_PRIORIDAD = '12.5';

function v12EsOrigenAutomatico_(origen) {
  return V12_ORIGENES_AUTOMATICOS.includes(normalizar(origen));
}

/* =========================================================
   PRIORIDAD DEL DIA

   REGLA V12.5

   1. ATENDIDO
      Cuenta solamente si FECHA FIN es hoy.

   2. DERIVADO
      No cuenta.

   3. CERRADO
      No cuenta, ya sea por DETALLE o ESTADO TICKET.

   4. EN REVISION / PENDIENTE / EN ESPERA / SEGUIMIENTO
      y cualquier otro detalle operativo
      Cuenta si FECHA INICIO es hoy.

   5. La hoja SEGUIMIENTO NO suma tickets al conteo.
      Solo sirve para disponibilidad/estado operativo.

   6. Cada ticket se cuenta una sola vez.

   7. PRIORIDAD = cantidad real contabilizada HOY, sin tope.
      No usa acumulado de tickets activos.

   8. V12 usa exactamente calcularConteoPrioridadHoy_ de Codigo.gs.
      Dashboard y asignacion usan la misma fuente.
========================================================= */
function calcularConteoPrioridadHoyV12_(
  nombreAsesor,
  ticketsBase,
  historialAsignaciones
) {
  return calcularConteoPrioridadHoy_(
    nombreAsesor,
    ticketsBase,
    historialAsignaciones
  );
}

function calcularEstadoOperativoAsesorV12_(
  usuario,
  ticketsBase,
  seguimiento,
  historialAsignaciones
) {
  const estadoBase = calcularEstadoOperativoAsesor(
    usuario,
    ticketsBase,
    seguimiento,
    historialAsignaciones
  );

  estadoBase.versionPrioridad = V12_VERSION_PRIORIDAD;
  return estadoBase;
}

/* =========================================================
   ORDEN DE PRIORIDAD

   ENTRE ASESORES DISPONIBLES:
   1. Menor cantidad contabilizada hoy.
   2. Ultima asignacion mas antigua.
   3. Orden configurado.
   4. Nombre.

   Los no disponibles se muestran despues.
========================================================= */
function compararPrioridadV12_(a, b) {
  const disponibleA = Boolean(
    a && a.activo && a.habilitado && a.disponible
  );
  const disponibleB = Boolean(
    b && b.activo && b.habilitado && b.disponible
  );

  if (disponibleA !== disponibleB) {
    return disponibleA ? -1 : 1;
  }

  const prioridadA = Number(a && a.prioridad || 0);
  const prioridadB = Number(b && b.prioridad || 0);

  if (prioridadA !== prioridadB) {
    return prioridadA - prioridadB;
  }

  const fechaA = parsearFechaFlexible(a && a.ultimaAsignacion);
  const fechaB = parsearFechaFlexible(b && b.ultimaAsignacion);

  const tiempoA = fechaA ? fechaA.getTime() : 0;
  const tiempoB = fechaB ? fechaB.getTime() : 0;

  return (
    tiempoA - tiempoB ||
    Number(a && a.orden || 999) - Number(b && b.orden || 999) ||
    String(a && a.asesor || '').localeCompare(
      String(b && b.asesor || ''),
      'es'
    )
  );
}

function obtenerDisponibilidadV12_(ticketsBase, seguimiento) {
  return obtenerUsuariosAsignacion()
    .map(usuario =>
      calcularEstadoOperativoAsesorV12_(
        usuario,
        ticketsBase,
        seguimiento
      )
    )
    .sort(compararPrioridadV12_);
}

function seleccionarSiguienteAsesorV12_(
  excluirAsesor,
  disponibilidad
) {
  const elegibles = (disponibilidad || [])
    .filter(item =>
      item.activo &&
      item.habilitado &&
      item.disponible &&
      (
        !excluirAsesor ||
        normalizar(item.asesor) !== normalizar(excluirAsesor)
      )
    )
    .sort(compararPrioridadV12_);

  return elegibles[0] || null;
}

function obtenerPendientesV12_(tickets) {
  return (tickets || [])
    .filter(ticket =>
      v12EsOrigenAutomatico_(ticket.origen) &&
      !limpiar(ticket.responsable) &&
      esTicketActivoParaCarga_(ticket)
    )
    .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));
}

function v12AsignarTicket_(base, ticket, asesor, usuarioEjecutor) {
  const origen = normalizar(ticket.origen);

  if (!v12EsOrigenAutomatico_(origen)) {
    throw new Error('El ticket no corresponde a Zendesk ni Dynamic');
  }

  if (limpiar(ticket.responsable)) {
    throw new Error('El ticket ya tiene responsable');
  }

  if (!esTicketActivoParaCarga_(ticket)) {
    throw new Error('El ticket ya no esta activo');
  }

  const ahora = new Date();

  escribirPorEncabezado_(
    base.hoja,
    base.mapa,
    ticket.rowNumber,
    'Responsable',
    asesor
  );

  const columnaFechaInicio =
    base.mapa[normalizar('Fecha inicio')];

  if (
    columnaFechaInicio &&
    !limpiar(ticket.fechaInicio)
  ) {
    const fechaInicioOperativa =
      calcularFechaInicioOperativa_(ahora) ||
      new Date(
        ahora.getFullYear(),
        ahora.getMonth(),
        ahora.getDate()
      );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'Fecha inicio',
      fechaInicioOperativa
    );

    base.hoja
      .getRange(
        ticket.rowNumber,
        columnaFechaInicio
      )
      .setNumberFormat('dd/MM/yyyy');

    ticket.fechaInicio =
      etiquetaFecha(fechaInicioOperativa);
    ticket.fechaInicioRaw =
      fechaInicioOperativa;
  }

  if (!limpiar(ticket.tiempoInicio)) {
    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'TIEMPO INICIO',
      ahora
    );

    ticket.tiempoInicio = formatearFechaHora(ahora);
    ticket.tiempoInicioRaw = ahora;
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
    `Asignacion automatica ${origen}`
  );

  ticket.responsable = asesor;
  ticket.fechaActualizacion = formatearFechaHora(ahora);

  return {
    numero: ticket.numero,
    ticket: ticket.ticket,
    alumno: ticket.alumno,
    origen,
    asesor
  };
}

function procesarPendientesV12(token) {
  const lock = LockService.getScriptLock();

  try {
    const validacion = validarAdmin(token);
    if (!validacion.ok) return validacion;

    lock.waitLock(30000);

    const base = leerTicketsBase();
    const todos = base.tickets || [];
    const seguimiento = leerSeguimientoOperativo_();
    const pendientes = obtenerPendientesV12_(todos);

    const asignados = [];
    const errores = [];

    for (const ticket of pendientes) {
      try {
        const disponibilidad = obtenerDisponibilidadV12_(
          todos,
          seguimiento
        );

        const recomendado = seleccionarSiguienteAsesorV12_(
          '',
          disponibilidad
        );

        if (!recomendado) {
          errores.push({
            numero: ticket.numero,
            ticket: ticket.ticket,
            origen: ticket.origen,
            message: 'No hay asesor disponible'
          });
          break;
        }

        const resultado = v12AsignarTicket_(
          base,
          ticket,
          recomendado.asesor,
          validacion.sesion.usuario
        );

        asignados.push(resultado);
      } catch (errorTicket) {
        errores.push({
          numero: ticket.numero,
          ticket: ticket.ticket,
          origen: ticket.origen,
          message: errorTicket.message
        });
      }
    }

    SpreadsheetApp.flush();

    const restantes = obtenerPendientesV12_(
      leerTicketsBase().tickets || []
    );

    let message = 'No existen pendientes Zendesk o Dynamic';

    if (asignados.length) {
      message = `${asignados.length} ticket(s) asignado(s) correctamente`;
    } else if (errores.length) {
      message = `No se asigno. ${errores[0].message}`;
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

/* =========================================================
   DATOS RAPIDOS PARA EL DASHBOARD PRINCIPAL
========================================================= */
function obtenerDashboardOperativoV12(token, filtros) {
  try {
    const validacion = validarAdmin(token);
    if (!validacion.ok) return validacion;

    const f = filtros || {};
    const mes = Number(f.mes || 0);
    const anio = Number(f.anio || 0);
    const plataformaFiltro = normalizar(f.plataforma || '');
    const asesorFiltro = limpiar(f.asesor || '__GLOBAL__');

    const base = leerTicketsBase();
    const todos = base.tickets || [];
    const seguimiento = leerSeguimientoOperativo_();

    const disponibilidad = obtenerDisponibilidadV12_(
      todos,
      seguimiento
    );

    const pendientes = obtenerPendientesV12_(todos);

    let periodo = todos.filter(ticket =>
      fechaEnPeriodo(
        ticket.registroRaw || ticket.registro,
        mes,
        anio
      )
    );

    if (plataformaFiltro) {
      periodo = periodo.filter(ticket =>
        normalizar(ticket.origen) === plataformaFiltro
      );
    }

    const esGlobal =
      !asesorFiltro ||
      asesorFiltro === '__GLOBAL__';

    const ticketsAsesor = esGlobal
      ? periodo
      : periodo.filter(ticket =>
          normalizar(ticket.responsable) === normalizar(asesorFiltro)
        );

    const atendidos = periodo.filter(ticket =>
      !esTicketActivoParaCarga_(ticket) &&
      V12_ORIGENES_DASHBOARD.includes(normalizar(ticket.origen))
    );

    const atendidosZendesk = atendidos.filter(ticket =>
      normalizar(ticket.origen) === 'ZENDESK'
    ).length;

    const atendidosPortal = atendidos.filter(ticket =>
      normalizar(ticket.origen) === 'PORTAL'
    ).length;

    const atendidosDynamic = atendidos.filter(ticket =>
      normalizar(ticket.origen) === 'DYNAMIC'
    ).length;

    const totalAtendidos =
      atendidosZendesk +
      atendidosPortal +
      atendidosDynamic;

    const activosGeneral = todos.filter(ticket =>
      esTicketActivoParaCarga_(ticket)
    ).length;

    const plataformaAsesor = {
      zendesk: ticketsAsesor.filter(ticket =>
        normalizar(ticket.origen) === 'ZENDESK'
      ).length,
      portal: ticketsAsesor.filter(ticket =>
        normalizar(ticket.origen) === 'PORTAL'
      ).length,
      dynamic: ticketsAsesor.filter(ticket =>
        normalizar(ticket.origen) === 'DYNAMIC'
      ).length,
      total: ticketsAsesor.length
    };

    const diarioDynamic = {};

    atendidos
      .filter(ticket => normalizar(ticket.origen) === 'DYNAMIC')
      .forEach(ticket => {
        const fecha =
          ticket.fechaFinRaw ||
          ticket.fechaFin ||
          ticket.tiempoFinRaw ||
          ticket.tiempoFin;

        const clave = claveFecha(fecha);
        if (!clave) return;

        diarioDynamic[clave] = {
          fecha: etiquetaFecha(fecha),
          total: Number(diarioDynamic[clave] && diarioDynamic[clave].total || 0) + 1
        };
      });

    const siguienteAsesor = seleccionarSiguienteAsesorV12_(
      '',
      disponibilidad
    );

    return {
      ok: true,
      versionPrioridad: V12_VERSION_PRIORIDAD,

      resumenGeneral: {
        activos: activosGeneral,
        atendidosZendesk,
        atendidosPortal,
        atendidosDynamic,
        totalAtendidos
      },

      atendidosDynamic,
      plataformaAsesor,
      disponibilidad,
      disponibles: disponibilidad.filter(item => item.disponible).length,
      siguienteAsesor,

      pendientes: pendientes.map(ticket => ({
        numero: ticket.numero,
        ticket: ticket.ticket,
        alumno: ticket.alumno,
        tipoTicket: ticket.tipoTicket,
        origen: normalizar(ticket.origen),
        antecedente: null
      })),

      pendientesResumen: {
        total: pendientes.length,
        zendesk: pendientes.filter(ticket => normalizar(ticket.origen) === 'ZENDESK').length,
        dynamic: pendientes.filter(ticket => normalizar(ticket.origen) === 'DYNAMIC').length
      },

      diarioDynamic: Object.values(diarioDynamic),

      fechaActualizacion: Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm:ss'
      )
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message
    };
  }
}
