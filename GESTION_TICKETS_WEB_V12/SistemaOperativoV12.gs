/* =========================================================
   SISTEMA OPERATIVO V12.5

   OBJETIVO:
   - UNA sola fuente para prioridad diaria y orden de asignacion.
   - No usa acumulados historicos como prioridad.
   - No depende del calculo viejo del dashboard.

   REGLA DIARIA:
   - ATENDIDO: cuenta si FECHA FIN = hoy.
   - DERIVADO / CERRADO / ESTADO TICKET CERRADO: no cuentan.
   - Otros estados operativos: FECHA INICIO = hoy Y existe una
     asignacion real de hoy en HISTORIAL_ASIGNACIONES.
   - SEGUIMIENTO solo interviene en disponibilidad, no suma prioridad.

   ORDEN:
   1) disponibles
   2) menor prioridad diaria
   3) ultima asignacion mas antigua
   4) orden configurado
   5) nombre
========================================================= */

const V12_ORIGENES_AUTOMATICOS = ['ZENDESK', 'DYNAMIC'];
const V12_ORIGENES_DASHBOARD = ['ZENDESK', 'PORTAL', 'DYNAMIC'];
const V12_VERSION_PRIORIDAD = '12.5';

function v12EsOrigenAutomatico_(origen) {
  return V12_ORIGENES_AUTOMATICOS.includes(normalizar(origen));
}

function v125ClaveTicket_(ticket) {
  const id = limpiar(ticket && ticket.ticket);
  if (id) return `T:${id}`;

  const numero = limpiar(ticket && ticket.numero);
  if (numero) return `N:${numero}`;

  const dni = limpiar(ticket && ticket.dni);
  const alumno = limpiar(ticket && ticket.alumno);
  if (dni || alumno) {
    return `D:${dni}|A:${alumno}|F:${ticket && ticket.rowNumber || ''}`;
  }

  return '';
}

function v125LeerAsignacionesHoy_() {
  const hoja = obtenerArchivo().getSheetByName('HISTORIAL_ASIGNACIONES');
  const mapaPorAsesor = {};

  if (!hoja || hoja.getLastRow() < 2) {
    return mapaPorAsesor;
  }

  const mapa = obtenerMapaEncabezados(hoja);
  const colFecha = mapa[normalizar('FECHA')];
  const colNumero = mapa[normalizar('N°')];
  const colTicket = mapa[normalizar('ID TICKET')];
  const colAsesor = mapa[normalizar('ASESOR')];

  if (!colFecha || !colAsesor) {
    return mapaPorAsesor;
  }

  const ultimaFila = hoja.getLastRow();
  const ultimaColumna = hoja.getLastColumn();
  const rango = hoja.getRange(2, 1, ultimaFila - 1, ultimaColumna);
  const valores = rango.getValues();
  const hoy = claveFecha(new Date());

  valores.forEach(fila => {
    const fecha = fila[colFecha - 1];
    const fechaOperativa = calcularFechaInicioOperativa_(fecha) || fecha;

    if (claveFecha(fechaOperativa) !== hoy) return;

    const asesor = limpiar(fila[colAsesor - 1]);
    if (!asesor) return;

    const ticket = colTicket ? limpiar(fila[colTicket - 1]) : '';
    const numero = colNumero ? limpiar(fila[colNumero - 1]) : '';
    const clave = ticket ? `T:${ticket}` : (numero ? `N:${numero}` : '');
    if (!clave) return;

    const claveAsesor = normalizar(asesor);
    if (!mapaPorAsesor[claveAsesor]) {
      mapaPorAsesor[claveAsesor] = new Set();
    }

    mapaPorAsesor[claveAsesor].add(clave);
  });

  return mapaPorAsesor;
}

function v125ConteoHoyAsesor_(nombreAsesor, ticketsBase, asignacionesHoy) {
  const hoy = claveFecha(new Date());
  const claveAsesor = normalizar(nombreAsesor);
  const asignadosHoy = asignacionesHoy[claveAsesor] || new Set();

  const recibidosHoy = new Set();
  const atendidosHoy = new Set();

  (ticketsBase || []).forEach(ticket => {
    if (normalizar(ticket.responsable) !== claveAsesor) return;

    const clave = v125ClaveTicket_(ticket);
    if (!clave) return;

    const detalle = normalizar(ticket.detalle);
    const estado = normalizar(ticket.estado);

    if (detalle === 'ATENDIDO') {
      const fechaFin = ticket.fechaFinRaw || ticket.fechaFin;
      if (claveFecha(fechaFin) === hoy) {
        atendidosHoy.add(clave);
      }
      return;
    }

    if (
      detalle === 'DERIVADO' ||
      detalle === 'CERRADO' ||
      estado === 'CERRADO'
    ) {
      return;
    }

    const fechaInicio = ticket.fechaInicioRaw || ticket.fechaInicio;
    if (claveFecha(fechaInicio) !== hoy) return;

    if (asignadosHoy.has(clave)) {
      recibidosHoy.add(clave);
    }
  });

  const unicos = new Set([...recibidosHoy, ...atendidosHoy]);
  const totalHoy = unicos.size;

  return {
    recibidosHoy: recibidosHoy.size,
    atendidosHoy: atendidosHoy.size,
    totalHoy,
    prioridad: totalHoy
  };
}

function v125EstadoAsesor_(usuario, ticketsBase, seguimiento, asignacionesHoy) {
  const nombre = usuario.asesor;
  const claveNombre = normalizar(nombre);

  const revisionBase = (ticketsBase || []).filter(ticket =>
    normalizar(ticket.responsable) === claveNombre &&
    normalizar(ticket.detalle) === 'EN REVISION' &&
    normalizar(ticket.estado) !== 'CERRADO'
  );

  const seguimientoAsesor = (seguimiento || []).filter(item =>
    normalizar(item.responsableActual) === claveNombre
  );

  const seguimientoBloqueante = seguimientoAsesor.filter(item =>
    detalleBloqueaDisponibilidad_(item.detalle)
  );

  const conteo = v125ConteoHoyAsesor_(
    nombre,
    ticketsBase,
    asignacionesHoy
  );

  const disponible = Boolean(
    usuario.activo &&
    usuario.habilitado &&
    revisionBase.length === 0 &&
    seguimientoBloqueante.length === 0
  );

  let nivel = 'disponible';
  let texto = `Disponible · Prioridad ${conteo.prioridad}`;
  let motivo = `${conteo.totalHoy} ticket(s) contabilizado(s) hoy`;

  if (!usuario.activo) {
    nivel = 'bloqueado';
    texto = 'Usuario inactivo';
    motivo = 'El usuario no esta activo';
  } else if (!usuario.habilitado) {
    nivel = 'bloqueado';
    texto = 'No participa';
    motivo = 'Asignacion deshabilitada';
  } else if (revisionBase.length > 0) {
    nivel = 'ocupado';
    texto = 'En revision atendiendo';
    motivo = `${revisionBase.length} ticket(s) En revision en BASE_TICKETS`;
  } else if (seguimientoBloqueante.length > 0) {
    nivel = 'ocupado';
    const detalles = [...new Set(seguimientoBloqueante.map(item => normalizar(item.detalle)))];

    if (detalles.includes('SEGUIMIENTO')) texto = 'En seguimiento';
    else if (detalles.includes('DERIVADO')) texto = 'Derivado en bandeja';
    else if (detalles.includes('ATENDIDO')) texto = 'Atendido en bandeja';
    else if (detalles.includes('CERRADO')) texto = 'Cerrado en bandeja';
    else texto = 'No disponible';

    motivo = `${seguimientoBloqueante.length} ticket(s) bloqueante(s) en SEGUIMIENTO`;
  }

  return {
    usuario: usuario.usuario,
    asesor: nombre,
    activo: usuario.activo,
    habilitado: usuario.habilitado,
    disponible,
    totalAtencionesHoy: conteo.totalHoy,
    asignadosHoy: conteo.totalHoy,
    prioridad: conteo.totalHoy,
    recibidosHoy: conteo.recibidosHoy,
    atendidosHoy: conteo.atendidosHoy,
    revision: revisionBase.length,
    seguimiento: seguimientoBloqueante.length,
    nivel,
    texto,
    motivo,
    orden: usuario.orden,
    ultimaAsignacion: usuario.ultimaAsignacion,
    versionPrioridad: V12_VERSION_PRIORIDAD,
    fuentePrioridad: 'HOY: FECHA FIN ATENDIDO + FECHA INICIO CONFIRMADA POR HISTORIAL',
    ticketsAfectados: [
      ...revisionBase.map(ticket => ({
        fuente: 'BASE_TICKETS',
        numero: ticket.numero,
        ticket: ticket.ticket,
        alumno: ticket.alumno,
        detalle: ticket.detalle,
        responsable: ticket.responsable
      })),
      ...seguimientoBloqueante.map(item => ({
        fuente: 'SEGUIMIENTO',
        numero: '',
        ticket: item.ticket,
        alumno: item.alumno,
        detalle: item.detalle,
        responsable: item.responsableActual
      }))
    ]
  };
}

function compararPrioridadV12_(a, b) {
  const disponibleA = Boolean(a && a.activo && a.habilitado && a.disponible);
  const disponibleB = Boolean(b && b.activo && b.habilitado && b.disponible);

  if (disponibleA !== disponibleB) return disponibleA ? -1 : 1;

  const prioridadA = Number(a && a.prioridad || 0);
  const prioridadB = Number(b && b.prioridad || 0);
  if (prioridadA !== prioridadB) return prioridadA - prioridadB;

  const fechaA = parsearFechaFlexible(a && a.ultimaAsignacion);
  const fechaB = parsearFechaFlexible(b && b.ultimaAsignacion);
  const tiempoA = fechaA ? fechaA.getTime() : 0;
  const tiempoB = fechaB ? fechaB.getTime() : 0;

  return (
    tiempoA - tiempoB ||
    Number(a && a.orden || 999) - Number(b && b.orden || 999) ||
    String(a && a.asesor || '').localeCompare(String(b && b.asesor || ''), 'es')
  );
}

function obtenerDisponibilidadV12_(ticketsBase, seguimiento, asignacionesHoy) {
  const mapaAsignaciones = asignacionesHoy || v125LeerAsignacionesHoy_();

  return obtenerUsuariosAsignacion()
    .map(usuario =>
      v125EstadoAsesor_(usuario, ticketsBase, seguimiento, mapaAsignaciones)
    )
    .sort(compararPrioridadV12_);
}

function seleccionarSiguienteAsesorV12_(excluirAsesor, disponibilidad) {
  const elegibles = (disponibilidad || [])
    .filter(item =>
      item.activo &&
      item.habilitado &&
      item.disponible &&
      (!excluirAsesor || normalizar(item.asesor) !== normalizar(excluirAsesor))
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

  escribirPorEncabezado_(base.hoja, base.mapa, ticket.rowNumber, 'Responsable', asesor);

  const columnaFechaInicio = base.mapa[normalizar('Fecha inicio')];
  if (columnaFechaInicio && !limpiar(ticket.fechaInicio)) {
    const fechaInicioOperativa = calcularFechaInicioOperativa_(ahora) ||
      new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'Fecha inicio',
      fechaInicioOperativa
    );

    base.hoja.getRange(ticket.rowNumber, columnaFechaInicio).setNumberFormat('dd/MM/yyyy');
    ticket.fechaInicio = etiquetaFecha(fechaInicioOperativa);
    ticket.fechaInicioRaw = fechaInicioOperativa;
  }

  if (!limpiar(ticket.tiempoInicio)) {
    escribirPorEncabezado_(base.hoja, base.mapa, ticket.rowNumber, 'TIEMPO INICIO', ahora);
    ticket.tiempoInicio = formatearFechaHora(ahora);
    ticket.tiempoInicioRaw = ahora;
  }

  escribirPorEncabezado_(base.hoja, base.mapa, ticket.rowNumber, 'FECHA ACTUALIZACIÓN', ahora);
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
    asesor,
    clave: v125ClaveTicket_(ticket)
  };
}

function v125RegistrarEnMapaAsignaciones_(mapa, asesor, clave) {
  const claveAsesor = normalizar(asesor);
  if (!mapa[claveAsesor]) mapa[claveAsesor] = new Set();
  if (clave) mapa[claveAsesor].add(clave);
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
    const asignacionesHoy = v125LeerAsignacionesHoy_();
    const pendientes = obtenerPendientesV12_(todos);

    const asignados = [];
    const errores = [];

    for (const ticket of pendientes) {
      try {
        const disponibilidad = obtenerDisponibilidadV12_(
          todos,
          seguimiento,
          asignacionesHoy
        );

        const recomendado = seleccionarSiguienteAsesorV12_('', disponibilidad);
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
        v125RegistrarEnMapaAsignaciones_(
          asignacionesHoy,
          resultado.asesor,
          resultado.clave
        );
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

    const restantes = obtenerPendientesV12_(leerTicketsBase().tickets || []);
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
    return { ok: false, message: error.message };
  } finally {
    try { lock.releaseLock(); } catch (error) {}
  }
}

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
    const asignacionesHoy = v125LeerAsignacionesHoy_();

    const disponibilidad = obtenerDisponibilidadV12_(
      todos,
      seguimiento,
      asignacionesHoy
    );

    const pendientes = obtenerPendientesV12_(todos);

    let periodo = todos.filter(ticket =>
      fechaEnPeriodo(ticket.registroRaw || ticket.registro, mes, anio)
    );

    if (plataformaFiltro) {
      periodo = periodo.filter(ticket => normalizar(ticket.origen) === plataformaFiltro);
    }

    const esGlobal = !asesorFiltro || asesorFiltro === '__GLOBAL__';
    const ticketsAsesor = esGlobal
      ? periodo
      : periodo.filter(ticket =>
          normalizar(ticket.responsable) === normalizar(asesorFiltro)
        );

    const atendidos = periodo.filter(ticket =>
      normalizar(ticket.detalle) === 'ATENDIDO' &&
      V12_ORIGENES_DASHBOARD.includes(normalizar(ticket.origen))
    );

    const atendidosZendesk = atendidos.filter(ticket => normalizar(ticket.origen) === 'ZENDESK').length;
    const atendidosPortal = atendidos.filter(ticket => normalizar(ticket.origen) === 'PORTAL').length;
    const atendidosDynamic = atendidos.filter(ticket => normalizar(ticket.origen) === 'DYNAMIC').length;
    const totalAtendidos = atendidosZendesk + atendidosPortal + atendidosDynamic;

    const activosGeneral = todos.filter(ticket => esTicketActivoParaCarga_(ticket)).length;

    const plataformaAsesor = {
      zendesk: ticketsAsesor.filter(ticket => normalizar(ticket.origen) === 'ZENDESK').length,
      portal: ticketsAsesor.filter(ticket => normalizar(ticket.origen) === 'PORTAL').length,
      dynamic: ticketsAsesor.filter(ticket => normalizar(ticket.origen) === 'DYNAMIC').length,
      total: ticketsAsesor.length
    };

    const diarioDynamic = {};
    atendidos
      .filter(ticket => normalizar(ticket.origen) === 'DYNAMIC')
      .forEach(ticket => {
        const fecha = ticket.fechaFinRaw || ticket.fechaFin || ticket.tiempoFinRaw || ticket.tiempoFin;
        const clave = claveFecha(fecha);
        if (!clave) return;

        diarioDynamic[clave] = {
          fecha: etiquetaFecha(fecha),
          total: Number(diarioDynamic[clave] && diarioDynamic[clave].total || 0) + 1
        };
      });

    const siguienteAsesor = seleccionarSiguienteAsesorV12_('', disponibilidad);

    return {
      ok: true,
      versionPrioridad: V12_VERSION_PRIORIDAD,
      fuentePrioridad: 'HOY: FECHA FIN ATENDIDO + FECHA INICIO CONFIRMADA POR HISTORIAL',
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
    return { ok: false, message: error.message };
  }
}
