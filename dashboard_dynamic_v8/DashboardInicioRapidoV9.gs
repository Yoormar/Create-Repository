/* =========================================================
   DASHBOARD INICIO RAPIDO V9
   Complemento seguro: no reemplaza funciones existentes.
========================================================= */

const DASHBOARD_INICIO_RAPIDO_V9_CACHE_SECONDS = 60;

function dashboardInicioRapidoV9Clave_(filtros) {
  const f = filtros || {};
  return [
    'DASH_INICIO_V9',
    limpiar(f.mes || ''),
    limpiar(f.anio || ''),
    normalizar(f.plataforma || ''),
    normalizar(f.asesor || '__GLOBAL__')
  ].join('|');
}

function obtenerDashboardInicioRapidoV9(token, filtros) {
  try {
    const validacion = validarAdmin(token);
    if (!validacion.ok) return validacion;

    const f = filtros || {};
    const cache = CacheService.getScriptCache();
    const claveCache = dashboardInicioRapidoV9Clave_(f);
    const guardado = cache.get(claveCache);

    if (guardado) {
      try {
        const datos = JSON.parse(guardado);
        if (datos && datos.ok) {
          datos.cache = true;
          return datos;
        }
      } catch (error) {}
    }

    /* Solo una lectura grande: BASE_TICKETS. */
    const todos = leerTicketsBase().tickets || [];

    const mes = Number(f.mes || 0);
    const anio = Number(f.anio || 0);
    const plataforma = normalizar(f.plataforma || '');
    const asesorFiltro = limpiar(f.asesor || '__GLOBAL__');

    let periodo = todos.filter(ticket =>
      fechaEnPeriodo(
        ticket.registroRaw || ticket.registro,
        mes,
        anio
      )
    );

    if (plataforma) {
      periodo = periodo.filter(ticket =>
        normalizar(ticket.origen) === plataforma
      );
    }

    const esGlobal =
      !asesorFiltro ||
      asesorFiltro === '__GLOBAL__';

    const ticketsAsesor = esGlobal
      ? periodo
      : periodo.filter(ticket =>
          normalizar(ticket.responsable) ===
          normalizar(asesorFiltro)
        );

    const activos = todos.filter(esTicketActivoParaCarga_);
    const atendidos = periodo.filter(ticket =>
      !esTicketActivoParaCarga_(ticket)
    );
    const activosAsesor = ticketsAsesor.filter(esTicketActivoParaCarga_);
    const atendidosAsesor = ticketsAsesor.filter(ticket =>
      !esTicketActivoParaCarga_(ticket)
    );

    const contarOrigen = (lista, origen) =>
      lista.filter(ticket =>
        normalizar(ticket.origen) === origen
      ).length;

    const estados = {
      enRevision: 0,
      pendiente: 0,
      enEspera: 0,
      seguimiento: 0,
      derivado: 0,
      atendido: atendidosAsesor.length
    };

    activosAsesor.forEach(ticket => {
      const detalle = normalizar(ticket.detalle);
      if (detalle === 'EN REVISION') estados.enRevision++;
      else if (detalle === 'PENDIENTE') estados.pendiente++;
      else if (detalle === 'EN ESPERA') estados.enEspera++;
      else if (detalle === 'SEGUIMIENTO') estados.seguimiento++;
      else if (detalle === 'DERIVADO') estados.derivado++;
    });

    const plataformaAsesor = {
      zendesk: contarOrigen(ticketsAsesor, 'ZENDESK'),
      portal: contarOrigen(ticketsAsesor, 'PORTAL'),
      dynamic: contarOrigen(ticketsAsesor, 'DYNAMIC'),
      total: ticketsAsesor.length
    };

    const salida = {
      ok: true,
      cache: false,
      filtros: {
        mes: f.mes || '',
        anio: f.anio || '',
        plataforma: f.plataforma || '',
        asesor: asesorFiltro
      },
      resumenGeneral: {
        activos: activos.length,
        atendidosZendesk: contarOrigen(atendidos, 'ZENDESK'),
        atendidosPortal: contarOrigen(atendidos, 'PORTAL'),
        atendidosDynamic: contarOrigen(atendidos, 'DYNAMIC'),
        totalAtendidos: atendidos.length
      },
      asesor: {
        nombre: esGlobal ? 'Vista global' : asesorFiltro,
        esGlobal: esGlobal,
        activos: activosAsesor.length,
        atendidos: atendidosAsesor.length,
        estados: estados,
        plataforma: plataformaAsesor
      },
      generado: Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm:ss'
      )
    };

    try {
      cache.put(
        claveCache,
        JSON.stringify(salida),
        DASHBOARD_INICIO_RAPIDO_V9_CACHE_SECONDS
      );
    } catch (error) {}

    return salida;

  } catch (error) {
    return {
      ok: false,
      message: error.message
    };
  }
}
