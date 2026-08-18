/* Dashboard Dynamic V8 - additive module. Existing files remain unchanged. */

const DASHBOARD_DYNAMIC_V8_CACHE_SECONDS = 90;

function dashboardDynamicV8FechaEntrada_(ticket) {
  return ticket.registroRaw || ticket.registro || ticket.fechaInicioRaw || ticket.fechaInicio || '';
}

function dashboardDynamicV8FechaSalida_(ticket) {
  return ticket.fechaFinRaw || ticket.fechaFin || ticket.tiempoFinRaw || ticket.tiempoFin || '';
}

function dashboardDynamicV8EsAtendido_(ticket) {
  return !esTicketActivoParaCarga_(ticket);
}

function dashboardDynamicV8ClaveCache_(filtros) {
  const f = filtros || {};
  return [
    'DASH_DYNAMIC_V8',
    limpiar(f.mes || ''),
    limpiar(f.anio || ''),
    normalizar(f.plataforma || ''),
    normalizar(f.asesor || '__GLOBAL__')
  ].join('|');
}

function dashboardDynamicV8CoincidePlataforma_(ticket, plataforma) {
  return !plataforma || normalizar(ticket.origen) === plataforma;
}

function dashboardDynamicV8CoincideAsesor_(ticket, asesor) {
  return !asesor || asesor === '__GLOBAL__' ||
    normalizar(ticket.responsable) === normalizar(asesor);
}

function obtenerDashboardDynamicV8(token, filtros) {
  try {
    const validacion = validarAdmin(token);
    if (!validacion.ok) return validacion;

    const f = filtros || {};
    const cache = CacheService.getScriptCache();
    const claveCache = dashboardDynamicV8ClaveCache_(f);
    const cacheActual = cache.get(claveCache);

    if (cacheActual) {
      try {
        const datosCache = JSON.parse(cacheActual);
        if (datosCache && datosCache.ok) {
          datosCache.cache = true;
          return datosCache;
        }
      } catch (error) {}
    }

    const todos = leerTicketsBase().tickets || [];
    const mes = Number(f.mes || 0);
    const anio = Number(f.anio || 0);
    const plataforma = normalizar(f.plataforma || '');
    const asesor = limpiar(f.asesor || '__GLOBAL__');

    const periodo = todos.filter(ticket =>
      dashboardDynamicV8CoincidePlataforma_(ticket, plataforma) &&
      fechaEnPeriodo(dashboardDynamicV8FechaEntrada_(ticket), mes, anio)
    );

    const ticketsAsesor = periodo.filter(ticket =>
      dashboardDynamicV8CoincideAsesor_(ticket, asesor)
    );

    const activos = todos.filter(esTicketActivoParaCarga_);
    const atendidos = periodo.filter(dashboardDynamicV8EsAtendido_);
    const atendidosAsesor = ticketsAsesor.filter(dashboardDynamicV8EsAtendido_);

    const contarOrigen = (lista, origen) =>
      lista.filter(ticket => normalizar(ticket.origen) === origen).length;

    const resumenGeneral = {
      activos: activos.length,
      atendidosZendesk: contarOrigen(atendidos, 'ZENDESK'),
      atendidosPortal: contarOrigen(atendidos, 'PORTAL'),
      atendidosDynamic: contarOrigen(atendidos, 'DYNAMIC'),
      totalAtendidos: atendidos.length
    };

    const plataformaAsesor = {
      zendesk: contarOrigen(ticketsAsesor, 'ZENDESK'),
      portal: contarOrigen(ticketsAsesor, 'PORTAL'),
      dynamic: contarOrigen(ticketsAsesor, 'DYNAMIC'),
      total: ticketsAsesor.length
    };

    const diarioMapa = {};

    ticketsAsesor.forEach(ticket => {
      const fecha = dashboardDynamicV8FechaEntrada_(ticket);
      const clave = claveFecha(fecha);
      if (!clave) return;

      if (!diarioMapa[clave]) {
        diarioMapa[clave] = {
          clave: clave,
          fecha: etiquetaFecha(fecha),
          ingresoZendesk: 0,
          ingresoPortal: 0,
          ingresoDynamic: 0,
          totalIngresado: 0,
          atendidoZendesk: 0,
          atendidoPortal: 0,
          atendidoDynamic: 0,
          totalAtendido: 0
        };
      }

      const fila = diarioMapa[clave];
      const origen = normalizar(ticket.origen);

      if (origen === 'PORTAL') fila.ingresoPortal++;
      else if (origen === 'DYNAMIC') fila.ingresoDynamic++;
      else if (origen === 'ZENDESK') fila.ingresoZendesk++;

      fila.totalIngresado++;

      if (dashboardDynamicV8EsAtendido_(ticket)) {
        if (origen === 'PORTAL') fila.atendidoPortal++;
        else if (origen === 'DYNAMIC') fila.atendidoDynamic++;
        else if (origen === 'ZENDESK') fila.atendidoZendesk++;
        fila.totalAtendido++;
      }
    });

    const diario = Object.values(diarioMapa).sort((a, b) =>
      String(a.clave).localeCompare(String(b.clave))
    );

    const asesores = [...new Set(
      todos.map(ticket => limpiar(ticket.responsable)).filter(Boolean)
    )];

    const hoy = claveFecha(new Date());

    const ranking = asesores.map(nombre => {
      const lista = periodo.filter(ticket =>
        normalizar(ticket.responsable) === normalizar(nombre)
      );
      const cerrados = lista.filter(dashboardDynamicV8EsAtendido_);
      const cerradosHoy = cerrados.filter(ticket =>
        claveFecha(dashboardDynamicV8FechaSalida_(ticket)) === hoy
      );

      return {
        asesor: nombre,
        hoyZendesk: contarOrigen(cerradosHoy, 'ZENDESK'),
        hoyPortal: contarOrigen(cerradosHoy, 'PORTAL'),
        hoyDynamic: contarOrigen(cerradosHoy, 'DYNAMIC'),
        totalHoy: cerradosHoy.length,
        global: cerrados.length
      };
    }).sort((a, b) =>
      b.global - a.global ||
      b.totalHoy - a.totalHoy ||
      String(a.asesor).localeCompare(String(b.asesor), 'es')
    );

    const salida = {
      ok: true,
      filtros: {
        mes: f.mes || '',
        anio: f.anio || '',
        plataforma: f.plataforma || '',
        asesor: asesor
      },
      resumenGeneral: resumenGeneral,
      asesor: {
        plataforma: plataformaAsesor,
        atendidos: atendidosAsesor.length
      },
      diario: diario,
      ranking: ranking,
      generado: Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm:ss'
      ),
      cache: false
    };

    try {
      cache.put(
        claveCache,
        JSON.stringify(salida),
        DASHBOARD_DYNAMIC_V8_CACHE_SECONDS
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
