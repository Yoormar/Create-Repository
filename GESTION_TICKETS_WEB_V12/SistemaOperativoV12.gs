/* =========================================================
   SISTEMA OPERATIVO V12
   - Prioridad diaria segun regla original de BASE_TICKETS
   - ATENDIDO cuenta por FECHA FIN
   - Otros estados operativos cuentan por FECHA INICIO
   - DERIVADO y CERRADO no cuentan
   - SEGUIMIENTO no suma prioridad, solo disponibilidad
   - Asignacion automatica ZENDESK + DYNAMIC
   - Dashboard superior sincronizado
========================================================= */

const V12_ORIGENES_AUTOMATICOS = ['ZENDESK', 'DYNAMIC'];
const V12_ORIGENES_DASHBOARD = ['ZENDESK', 'PORTAL', 'DYNAMIC'];

function v12EsOrigenAutomatico_(origen) {
  return V12_ORIGENES_AUTOMATICOS.includes(normalizar(origen));
}

function v12ClaveTicket_(ticket) {
  const idTicket = limpiar(ticket && ticket.ticket);
  if (idTicket) return `T:${idTicket}`;

  const numero = limpiar(ticket && ticket.numero);
  if (numero) return `N:${numero}`;

  const dni = limpiar(ticket && ticket.dni);
  const alumno = limpiar(ticket && ticket.alumno);

  if (dni || alumno) {
    return `D:${dni}|A:${alumno}|F:${ticket && ticket.rowNumber || ''}`;
  }

  return '';
}

function v12CuentaPorFechaInicio_(detalle) {
  const d = normalizar(detalle);

  if (!d) return false;

  return ![
    'ATENDIDO',
    'DERIVADO',
    'CERRADO'
  ].includes(d);
}

/* =========================================================
   PRIORIDAD DEL DIA

   REGLA V12.3 - recupera la regla original del sistema:

   1. ATENDIDO
      Cuenta si FECHA FIN es hoy.

   2. DERIVADO
      No cuenta.

   3. CERRADO
      No cuenta.

   4. EN REVISION / PENDIENTE / EN ESPERA / SEGUIMIENTO
      y cualquier otro detalle operativo
      Cuenta si FECHA INICIO es hoy.

   5. La hoja SEGUIMIENTO NO suma tickets al conteo.
      Solo sirve para disponibilidad/estado operativo.

   6. Cada ticket se cuenta una sola vez.
========================================================= */
function calcularConteoPrioridadHoyV12_(nombreAsesor, ticketsBase) {
  const hoy = claveFecha(new Date());
  const recibidosHoy = new Set();
  const atendidosHoy = new Set();

  (ticketsBase || []).forEach(ticket => {
    if (
      normalizar(ticket.responsable) !==
      normalizar(nombreAsesor)
    ) {
      return;
    }

    const clave = v12ClaveTicket_(ticket);
    if (!clave) return;

    const detalle = normalizar(ticket.detalle);

    /* ATENDIDO: solo FECHA FIN. */
    if (detalle === 'ATENDIDO') {
      const fechaFin =
        ticket.fechaFinRaw ||
        ticket.fechaFin;

      if (claveFecha(fechaFin) === hoy) {
        atendidosHoy.add(clave);
      }

      return;
    }

    /* DERIVADO / CERRADO: no cuentan. */
    if (
      detalle === 'DERIVADO' ||
      detalle === 'CERRADO'
    ) {
      return;
    }

    /* Otros estados operativos: FECHA INICIO. */
    if (!v12CuentaPorFechaInicio_(detalle)) {
      return;
    }

    const fechaInicio =
      ticket.fechaInicioRaw ||
      ticket.fechaInicio;

    if (claveFecha(fechaInicio) === hoy) {
      recibidosHoy.add(clave);
    }
  });

  const totalUnico = new Set([
    ...recibidosHoy,
    ...atendidosHoy
  ]);

  const totalHoy = totalUnico.size;

  return {
    recibidosHoy: recibidosHoy.size,
    atendidosHoy: atendidosHoy.size,
    totalHoy,
    prioridad: totalHoy
  };
}

function calcularEstadoOperativoAsesorV12_(
  usuario,
  ticketsBase,
  seguimiento
) {
  /*
   * La disponibilidad sigue usando exactamente las reglas
   * existentes. Solo reemplazamos el conteo/prioridad diaria.
   */
  const estadoBase = calcularEstadoOperativoAsesor(
    usuario,
    ticketsBase,
    seguimiento
  );

  const conteo = calcularConteoPrioridadHoyV12_(
    usuario.asesor,
    ticketsBase
  );

  estadoBase.totalAtencionesHoy = conteo.totalHoy;
  estadoBase.asignadosHoy = conteo.totalHoy;
  estadoBase.recibidosHoy = conteo.recibidosHoy;
  estadoBase.atendidosHoy = conteo.atendidosHoy;
  estadoBase.prioridad = conteo.prioridad;

  if (estadoBase.disponible) {
    estadoBase.texto = `Disponible · Prioridad ${conteo.prioridad}`;
    estadoBase.motivo = `${conteo.totalHoy} ticket(s) contabilizado(s) hoy`;
  }

  return estadoBase;
}

function obtenerDisponibilidadV12_(ticketsBase, seguimiento) {
  return obtenerUsuariosAsignacion()
    .map(usuario =>
      calcularEstadoOperativoAsesorV12_(
        usuario,
        ticketsBase,
        seguimiento
      )
    );
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
    );

  if (!elegibles.length) return null;

  /* Menor cantidad contabilizada hoy primero. */
  const minimo = Math.min(
    ...elegibles.map(item => Number(item.totalAtencionesHoy || 0))
  );

  const candidatos = elegibles
    .filter(item => Number(item.totalAtencionesHoy || 0) === minimo)
    .sort((a, b) => {
      const fechaA = parsearFechaFlexible(a.ultimaAsignacion);
      const fechaB = parsearFechaFlexible(b.ultimaAsignacion);

      const tiempoA = fechaA ? fechaA.getTime() : 0;
      const tiempoB = fechaB ? fechaB.getTime() : 0;

      return (
        tiempoA - tiempoB ||
        Number(a.orden || 999) - Number(b.orden || 999) ||
        String(a.asesor || '').localeCompare(String(b.asesor || ''), 'es')
      );
    });

  return candidatos[0] || null;
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

  /*
   * TIEMPO INICIO se mantiene para medicion de tiempos.
   * La prioridad NO usa este campo.
   */
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

    /*
     * Los KPI de atendidos se calculan todos desde la MISMA
     * lista y con los mismos filtros para evitar desfases.
     */
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

      resumenGeneral: {
        activos: activosGeneral,
        atendidosZendesk,
        atendidosPortal,
        atendidosDynamic,
        totalAtendidos
      },

      /* Compatibilidad con versiones V12 anteriores. */
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
