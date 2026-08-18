/* =========================================================
   SISTEMA V11 CENTRAL
   Complemento para el Código.gs actual.

   OBJETIVOS
   - Dashboard rápido sin repetir lecturas pesadas.
   - DYNAMIC nativo en indicadores, diario y ranking.
   - Asignación automática solo para ZENDESK + DYNAMIC.
   - PORTAL conserva su flujo actual.
   - Notificación al asesor por nuevas asignaciones.
========================================================= */

const V11_ORIGENES_AUTOMATICOS = [
  'ZENDESK',
  'DYNAMIC'
];

const V11_CACHE_DASHBOARD_SEGUNDOS = 45;
const V11_TRIGGER_ASIGNACION = 'procesarPendientesSistemaV11';


/* =========================================================
   UTILIDADES V11
========================================================= */

function v11ContarOrigen_(lista, origen) {
  return (lista || []).filter(
    ticket =>
      normalizar(ticket.origen) ===
      normalizar(origen)
  ).length;
}


function v11ClaveDashboard_(filtros) {
  const f = filtros || {};

  return [
    'DASH_V11',
    limpiar(f.mes || ''),
    limpiar(f.anio || ''),
    normalizar(f.plataforma || ''),
    normalizar(f.asesor || '__GLOBAL__')
  ].join('|');
}


function v11MapaCalendarioDesdeRegistros_(registros) {
  const mapa = {};

  (registros || []).forEach(
    item => {
      if (item && item.fecha) {
        mapa[item.fecha] =
          Boolean(item.laborable);
      }
    }
  );

  return mapa;
}


function v11EsDiaLaborableConMapa_(fecha, mapa) {
  const clave = claveFecha(fecha);

  if (!clave) {
    return false;
  }

  if (
    Object.prototype
      .hasOwnProperty
      .call(
        mapa || {},
        clave
      )
  ) {
    return Boolean(
      mapa[clave]
    );
  }

  return true;
}


function v11CalcularMilisegundosLaborales_(
  inicio,
  fin,
  mapaCalendario
) {
  const fechaInicio =
    parsearFechaFlexible(inicio);

  const fechaFin =
    parsearFechaFlexible(fin);

  if (
    !fechaInicio ||
    !fechaFin ||
    fechaFin < fechaInicio
  ) {
    return 0;
  }

  let total = 0;

  const cursor =
    new Date(
      fechaInicio.getFullYear(),
      fechaInicio.getMonth(),
      fechaInicio.getDate()
    );

  const ultimoDia =
    new Date(
      fechaFin.getFullYear(),
      fechaFin.getMonth(),
      fechaFin.getDate()
    );

  while (cursor <= ultimoDia) {
    if (
      v11EsDiaLaborableConMapa_(
        cursor,
        mapaCalendario
      )
    ) {
      const inicioDia =
        new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          0,
          0,
          0,
          0
        );

      const finDia =
        new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          23,
          59,
          59,
          999
        );

      const tramoInicio =
        fechaInicio > inicioDia
          ? fechaInicio
          : inicioDia;

      const tramoFin =
        fechaFin < finDia
          ? fechaFin
          : finDia;

      if (tramoFin > tramoInicio) {
        total +=
          tramoFin.getTime() -
          tramoInicio.getTime();
      }
    }

    cursor.setDate(
      cursor.getDate() + 1
    );
  }

  return total;
}


function v11PromedioDuracionTickets_(
  tickets,
  mapaCalendario
) {
  const duraciones =
    (tickets || [])
      .map(
        ticket =>
          v11CalcularMilisegundosLaborales_(
            ticket.tiempoInicioRaw ||
              ticket.tiempoInicio,
            ticket.tiempoFinRaw ||
              ticket.tiempoFin,
            mapaCalendario
          )
      )
      .filter(
        valor => valor > 0
      );

  if (!duraciones.length) {
    return '0 minutos';
  }

  const promedio =
    duraciones.reduce(
      (suma, valor) =>
        suma + valor,
      0
    ) /
    duraciones.length;

  return formatearDuracion(
    promedio
  );
}


function v11ObtenerTicketsDatosIncompletos_(todos) {
  return (todos || [])
    .filter(
      ticket =>
        esTicketActivoParaCarga_(ticket) &&
        obtenerCamposFaltantesDatos(ticket).length
    )
    .map(
      ticket => ({
        numero: ticket.numero,
        ticket: ticket.ticket,
        dni: ticket.dni,
        alumno: ticket.alumno,
        responsable:
          ticket.responsable ||
          'Sin responsable',
        camposFaltantes:
          obtenerCamposFaltantesDatos(ticket)
      })
    );
}


function v11ResolverAlertasDatos_(todos) {
  try {
    const incompletos =
      new Set(
        v11ObtenerTicketsDatosIncompletos_(todos)
          .map(
            ticket =>
              String(ticket.numero)
          )
      );

    const hoja =
      obtenerOCrearHojaAlertasDatos();

    if (hoja.getLastRow() < 2) {
      return 0;
    }

    const mapa =
      obtenerMapaEncabezados(hoja);

    let resueltas = 0;

    leerAlertasDatosActivas()
      .forEach(
        alerta => {
          if (
            !incompletos.has(
              String(alerta.numero)
            )
          ) {
            escribirPorEncabezado_(
              hoja,
              mapa,
              alerta.rowNumber,
              'ESTADO',
              'RESUELTA'
            );

            escribirPorEncabezado_(
              hoja,
              mapa,
              alerta.rowNumber,
              'FECHA RESOLUCIÓN',
              new Date()
            );

            resueltas++;
          }
        }
      );

    return resueltas;

  } catch (error) {
    console.error(
      'V11 alertas datos:',
      error
    );

    return 0;
  }
}


function v11PendientesAutomaticosDesdeTickets_(todos) {
  return (todos || [])
    .filter(
      ticket =>
        V11_ORIGENES_AUTOMATICOS
          .includes(
            normalizar(ticket.origen)
          ) &&
        !limpiar(ticket.responsable) &&
        esTicketActivoParaCarga_(ticket)
    );
}


/* =========================================================
   DASHBOARD CENTRAL V11
========================================================= */

function obtenerDashboardAdminV11(
  token,
  filtros,
  forzar
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const f = filtros || {};
    const cache =
      CacheService.getScriptCache();

    const claveCache =
      v11ClaveDashboard_(f);

    if (!forzar) {
      const cacheActual =
        cache.get(claveCache);

      if (cacheActual) {
        try {
          const datos =
            JSON.parse(cacheActual);

          if (datos && datos.ok) {
            datos.cache = true;
            return datos;
          }
        } catch (error) {}
      }
    }

    /*
     * Lecturas principales: una sola vez por hoja.
     */
    const todos =
      leerTicketsBase().tickets || [];

    const seguimientoOperativo =
      leerSeguimientoOperativo_();

    const usuariosAsignacion =
      obtenerUsuariosAsignacion();

    const calendarioLaboral =
      leerCalendarioLaboralInterno_();

    const mapaCalendario =
      v11MapaCalendarioDesdeRegistros_(
        calendarioLaboral
      );

    const alertasPortal =
      leerAlertasPortalPendientes_();

    v11ResolverAlertasDatos_(todos);

    const alertasDatos =
      v11ObtenerTicketsDatosIncompletos_(
        todos
      );

    const asesores =
      usuariosAsignacion
        .map(item => item.asesor)
        .filter(Boolean);

    const mes =
      Number(f.mes || 0);

    const anio =
      Number(f.anio || 0);

    const plataforma =
      normalizar(
        f.plataforma || ''
      );

    const asesorFiltro =
      limpiar(
        f.asesor ||
        '__GLOBAL__'
      );

    let periodo =
      todos.filter(
        ticket =>
          fechaEnPeriodo(
            ticket.registroRaw ||
              ticket.registro,
            mes,
            anio
          )
      );

    if (plataforma) {
      periodo =
        periodo.filter(
          ticket =>
            normalizar(
              ticket.origen
            ) === plataforma
        );
    }

    const esGlobal =
      !asesorFiltro ||
      asesorFiltro ===
        '__GLOBAL__';

    const ticketsAsesor =
      esGlobal
        ? periodo
        : periodo.filter(
            ticket =>
              normalizar(
                ticket.responsable
              ) ===
              normalizar(
                asesorFiltro
              )
          );

    const activos =
      todos.filter(
        esTicketActivoParaCarga_
      );

    const atendidos =
      periodo.filter(
        ticket =>
          !esTicketActivoParaCarga_(
            ticket
          )
      );

    const activosAsesor =
      ticketsAsesor.filter(
        esTicketActivoParaCarga_
      );

    const atendidosAsesor =
      ticketsAsesor.filter(
        ticket =>
          !esTicketActivoParaCarga_(
            ticket
          )
      );

    const disponibilidad =
      usuariosAsignacion.map(
        usuario =>
          calcularEstadoOperativoAsesor(
            usuario,
            todos,
            seguimientoOperativo
          )
      );

    const disponibilidadAsesor =
      esGlobal
        ? {
            texto: 'Vista global',
            nivel: 'disponible'
          }
        : disponibilidad.find(
            item =>
              normalizar(item.asesor) ===
              normalizar(asesorFiltro)
          ) || {
            texto: 'Sin información',
            nivel: 'bloqueado'
          };

    const estados = {
      enRevision:
        activosAsesor.filter(
          ticket =>
            normalizar(ticket.detalle) ===
            'EN REVISION'
        ).length,

      pendiente:
        activosAsesor.filter(
          ticket =>
            normalizar(ticket.detalle) ===
            'PENDIENTE'
        ).length,

      enEspera:
        activosAsesor.filter(
          ticket =>
            normalizar(ticket.detalle) ===
            'EN ESPERA'
        ).length,

      seguimiento:
        activosAsesor.filter(
          ticket =>
            normalizar(ticket.detalle) ===
            'SEGUIMIENTO'
        ).length,

      derivado:
        ticketsAsesor.filter(
          ticket =>
            normalizar(ticket.detalle) ===
            'DERIVADO'
        ).length,

      atendido:
        atendidosAsesor.length
    };

    const plataformaAsesor = {
      zendesk:
        v11ContarOrigen_(
          ticketsAsesor,
          'ZENDESK'
        ),

      portal:
        v11ContarOrigen_(
          ticketsAsesor,
          'PORTAL'
        ),

      dynamic:
        v11ContarOrigen_(
          ticketsAsesor,
          'DYNAMIC'
        ),

      total:
        ticketsAsesor.length
    };


    /* =====================================================
       EVOLUCIÓN / ATENCIÓN DIARIA
    ===================================================== */

    const diarioMapa = {};

    ticketsAsesor.forEach(
      ticket => {
        const fechaEntrada =
          ticket.registroRaw ||
          ticket.registro;

        const clave =
          claveFecha(fechaEntrada);

        if (!clave) {
          return;
        }

        if (!diarioMapa[clave]) {
          diarioMapa[clave] = {
            clave,
            fecha:
              etiquetaFecha(fechaEntrada),

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

        const fila =
          diarioMapa[clave];

        const origen =
          normalizar(ticket.origen);

        if (origen === 'PORTAL') {
          fila.ingresoPortal++;

        } else if (
          origen === 'DYNAMIC'
        ) {
          fila.ingresoDynamic++;

        } else if (
          origen === 'ZENDESK'
        ) {
          fila.ingresoZendesk++;
        }

        fila.totalIngresado++;

        if (
          !esTicketActivoParaCarga_(
            ticket
          )
        ) {
          if (origen === 'PORTAL') {
            fila.atendidoPortal++;

          } else if (
            origen === 'DYNAMIC'
          ) {
            fila.atendidoDynamic++;

          } else if (
            origen === 'ZENDESK'
          ) {
            fila.atendidoZendesk++;
          }

          fila.totalAtendido++;
        }
      }
    );

    const diario =
      Object.values(diarioMapa)
        .sort(
          (a, b) =>
            a.clave.localeCompare(
              b.clave
            )
        );


    /* =====================================================
       RANKING
    ===================================================== */

    const hoy =
      claveFecha(new Date());

    const ranking =
      asesores
        .map(
          asesor => {
            const lista =
              periodo.filter(
                ticket =>
                  normalizar(
                    ticket.responsable
                  ) ===
                  normalizar(asesor)
              );

            const cerrados =
              lista.filter(
                ticket =>
                  !esTicketActivoParaCarga_(
                    ticket
                  )
              );

            const cerradosHoy =
              cerrados.filter(
                ticket =>
                  claveFecha(
                    ticket.fechaFinRaw ||
                    ticket.fechaFin ||
                    ticket.tiempoFinRaw ||
                    ticket.tiempoFin
                  ) === hoy
              );

            return {
              asesor,

              hoyZendesk:
                v11ContarOrigen_(
                  cerradosHoy,
                  'ZENDESK'
                ),

              hoyPortal:
                v11ContarOrigen_(
                  cerradosHoy,
                  'PORTAL'
                ),

              hoyDynamic:
                v11ContarOrigen_(
                  cerradosHoy,
                  'DYNAMIC'
                ),

              totalHoy:
                cerradosHoy.length,

              global:
                cerrados.length
            };
          }
        )
        .sort(
          (a, b) =>
            b.global - a.global ||
            b.totalHoy - a.totalHoy
        );


    /* =====================================================
       CAMPUS
    ===================================================== */

    const campusMapa = {};

    periodo.forEach(
      ticket => {
        const campus =
          limpiar(ticket.campus) ||
          'Sin campus';

        campusMapa[campus] =
          (campusMapa[campus] || 0) + 1;
      }
    );

    const campus =
      Object.entries(campusMapa)
        .map(
          ([nombre, total]) => ({
            campus: nombre,
            total
          })
        )
        .sort(
          (a, b) =>
            b.total - a.total
        );


    /* =====================================================
       ALERTAS Y PENDIENTES
    ===================================================== */

    const alertasAsignacion =
      disponibilidad
        .filter(
          item =>
            [
              'alerta',
              'bloqueado'
            ].includes(
              item.nivel
            )
        )
        .map(
          item => ({
            asesor: item.asesor,
            motivo:
              item.motivo ||
              item.texto,
            ticketsAfectados:
              item.ticketsAfectados || []
          })
        );

    const pendientesAutomaticos =
      v11PendientesAutomaticosDesdeTickets_(
        todos
      );

    const pendientesZendesk =
      pendientesAutomaticos
        .filter(
          ticket =>
            normalizar(ticket.origen) ===
            'ZENDESK'
        )
        .map(
          ticket => ({
            numero: ticket.numero,
            ticket: ticket.ticket,
            alumno: ticket.alumno,
            tipoTicket: ticket.tipoTicket,
            antecedente: null
          })
        );


    const salida = {
      ok: true,
      version: `${VERSION}-V11`,
      cache: false,

      filtros: {
        mes: f.mes || '',
        anio: f.anio || '',
        plataforma:
          f.plataforma || '',
        asesor:
          asesorFiltro
      },

      resumenGeneral: {
        activos:
          activos.length,

        atendidosZendesk:
          v11ContarOrigen_(
            atendidos,
            'ZENDESK'
          ),

        atendidosPortal:
          v11ContarOrigen_(
            atendidos,
            'PORTAL'
          ),

        atendidosDynamic:
          v11ContarOrigen_(
            atendidos,
            'DYNAMIC'
          ),

        totalAtendidos:
          atendidos.length,

        alertasPortal:
          alertasPortal.length,

        asesoresDisponibles:
          disponibilidad.filter(
            item => item.disponible
          ).length
      },

      asesores,

      asesor: {
        nombre:
          esGlobal
            ? 'Vista global'
            : asesorFiltro,

        esGlobal,

        activos:
          activosAsesor.length,

        atendidos:
          atendidosAsesor.length,

        tiempoPromedio:
          v11PromedioDuracionTickets_(
            atendidosAsesor,
            mapaCalendario
          ),

        disponibilidad: {
          texto:
            disponibilidadAsesor.texto,
          nivel:
            disponibilidadAsesor.nivel
        },

        estados,
        plataforma:
          plataformaAsesor
      },

      diario,
      ranking,
      campus,

      disponibilidadAsesores:
        disponibilidad,

      alertasAsignacion,

      siguienteAsesor:
        seleccionarSiguienteAsesor(
          '',
          disponibilidad
        ),

      /*
       * Se conserva esta propiedad para que
       * el Scripts.html actual no se rompa.
       */
      pendientesAsignacionZendesk:
        pendientesZendesk,

      pendientesAsignacionV11: {
        total:
          pendientesAutomaticos.length,
        zendesk:
          pendientesAutomaticos.filter(
            ticket =>
              normalizar(ticket.origen) ===
              'ZENDESK'
          ).length,
        dynamic:
          pendientesAutomaticos.filter(
            ticket =>
              normalizar(ticket.origen) ===
              'DYNAMIC'
          ).length
      },

      alertasDatos: {
        total:
          alertasDatos.length,
        activas:
          alertasDatos.length,
        tickets:
          alertasDatos
      },

      alertasPortal: {
        total:
          alertasPortal.length,
        pendientes:
          alertasPortal,
        responsables:
          disponibilidad
      },

      responsablesPortal:
        disponibilidad,

      calendarioLaboral
    };

    try {
      cache.put(
        claveCache,
        JSON.stringify(salida),
        V11_CACHE_DASHBOARD_SEGUNDOS
      );
    } catch (error) {}

    return salida;

  } catch (error) {
    return {
      ok: false,
      message:
        error.message,
      version:
        `${VERSION}-V11`
    };
  }
}


/* =========================================================
   ASIGNACIÓN AUTOMÁTICA ZENDESK + DYNAMIC
========================================================= */

function obtenerPendientesAsignacionV11(token) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const pendientes =
      v11PendientesAutomaticosDesdeTickets_(
        leerTicketsBase().tickets
      );

    return {
      ok: true,
      total:
        pendientes.length,
      zendesk:
        pendientes.filter(
          ticket =>
            normalizar(ticket.origen) ===
            'ZENDESK'
        ).length,
      dynamic:
        pendientes.filter(
          ticket =>
            normalizar(ticket.origen) ===
            'DYNAMIC'
        ).length
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


function v11SeleccionarSiguienteAsesor_(
  usuarios,
  tickets,
  seguimiento,
  excluirAsesor
) {
  const disponibilidad =
    (usuarios || []).map(
      usuario =>
        calcularEstadoOperativoAsesor(
          usuario,
          tickets,
          seguimiento
        )
    );

  return seleccionarSiguienteAsesor(
    excluirAsesor || '',
    disponibilidad
  );
}


function v11ActualizarUltimaAsignacionMemoria_(
  usuarios,
  asesor
) {
  const ahora =
    new Date();

  (usuarios || []).forEach(
    usuario => {
      if (
        normalizar(usuario.asesor) ===
        normalizar(asesor)
      ) {
        usuario.ultimaAsignacion =
          ahora;
      }
    }
  );
}


function v11AsignarTicket_(
  ticket,
  asesor,
  usuarioEjecutor,
  base
) {
  const origen =
    normalizar(ticket.origen);

  if (
    !V11_ORIGENES_AUTOMATICOS
      .includes(origen)
  ) {
    throw new Error(
      'El ticket no es Zendesk ni Dynamic'
    );
  }

  if (
    limpiar(ticket.responsable)
  ) {
    throw new Error(
      'El ticket ya tiene responsable'
    );
  }

  if (
    !esTicketActivoParaCarga_(
      ticket
    )
  ) {
    throw new Error(
      'El ticket ya no está activo'
    );
  }

  const ahora =
    new Date();

  escribirPorEncabezado_(
    base.hoja,
    base.mapa,
    ticket.rowNumber,
    'Responsable',
    asesor
  );

  if (
    !limpiar(
      ticket.tiempoInicio
    )
  ) {
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

  actualizarUltimaAsignacionUsuario(
    asesor
  );

  registrarAsignacionRotativa(
    ticket,
    asesor,
    usuarioEjecutor,
    origen,
    `Asignación automática ${origen}`
  );

  ticket.responsable =
    asesor;

  ticket.tiempoInicio =
    ticket.tiempoInicio ||
    formatearFechaHora(ahora);

  return {
    numero:
      ticket.numero,
    ticket:
      ticket.ticket,
    alumno:
      ticket.alumno,
    origen,
    asesor
  };
}


function v11ProcesarPendientesCore_(
  usuarioEjecutor
) {
  const lock =
    LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const base =
      leerTicketsBase();

    const todos =
      base.tickets;

    const seguimiento =
      leerSeguimientoOperativo_();

    const usuarios =
      obtenerUsuariosAsignacion();

    const pendientes =
      v11PendientesAutomaticosDesdeTickets_(
        todos
      )
        .sort(
          (a, b) =>
            Number(a.numero || 0) -
            Number(b.numero || 0)
        );

    const asignados = [];
    const errores = [];

    for (
      const ticket of pendientes
    ) {
      try {
        const recomendado =
          v11SeleccionarSiguienteAsesor_(
            usuarios,
            todos,
            seguimiento,
            ''
          );

        if (!recomendado) {
          errores.push({
            numero:
              ticket.numero,
            ticket:
              ticket.ticket,
            origen:
              ticket.origen,
            message:
              'No hay asesor disponible'
          });

          break;
        }

        const resultado =
          v11AsignarTicket_(
            ticket,
            recomendado.asesor,
            usuarioEjecutor ||
              'SISTEMA_AUTO',
            base
          );

        asignados.push(
          resultado
        );

        v11ActualizarUltimaAsignacionMemoria_(
          usuarios,
          recomendado.asesor
        );

      } catch (error) {
        errores.push({
          numero:
            ticket.numero,
          ticket:
            ticket.ticket,
          origen:
            ticket.origen,
          message:
            error.message
        });
      }
    }

    SpreadsheetApp.flush();

    /*
     * Invalida la respuesta de dashboard
     * para que la próxima actualización vea
     * las nuevas asignaciones.
     */
    try {
      CacheService
        .getScriptCache()
        .removeAll([
          v11ClaveDashboard_({})
        ]);
    } catch (error) {}

    const restantes =
      v11PendientesAutomaticosDesdeTickets_(
        leerTicketsBase().tickets
      );

    let message =
      'No existen pendientes Zendesk o Dynamic';

    if (asignados.length) {
      message =
        `${asignados.length} ticket(s) asignado(s) correctamente`;

    } else if (errores.length) {
      message =
        `No se asignó. ${errores[0].message}`;
    }

    return {
      ok: true,
      encontrados:
        pendientes.length,
      totalAsignados:
        asignados.length,
      asignados,
      restantes:
        restantes.length,
      errores,
      message
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (error) {}
  }
}


function procesarPendientesV11(token) {
  const validacion =
    validarAdmin(token);

  if (!validacion.ok) {
    return validacion;
  }

  return v11ProcesarPendientesCore_(
    validacion.sesion.usuario
  );
}


function procesarPendientesSistemaV11() {
  return v11ProcesarPendientesCore_(
    'SISTEMA_AUTO'
  );
}


function asegurarAsignacionAutomaticaV11(token) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const existe =
      ScriptApp
        .getProjectTriggers()
        .some(
          trigger =>
            trigger.getHandlerFunction() ===
            V11_TRIGGER_ASIGNACION
        );

    if (!existe) {
      ScriptApp
        .newTrigger(
          V11_TRIGGER_ASIGNACION
        )
        .timeBased()
        .everyMinutes(1)
        .create();
    }

    return {
      ok: true,
      instalado:
        !existe,
      message:
        existe
          ? 'Asignación automática ya estaba activa'
          : 'Asignación automática activada cada minuto'
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


/* =========================================================
   NOTIFICACIONES AL ASESOR
========================================================= */

function obtenerNotificacionesAsignacionV11(
  token,
  despuesDeMs
) {
  try {
    const validacion =
      validarSesion(token);

    if (!validacion.ok) {
      return validacion;
    }

    const sesion =
      validacion.sesion;

    if (sesion.rol === 'ADMIN') {
      return {
        ok: true,
        notificaciones: [],
        ahoraMs:
          Date.now()
      };
    }

    const asesor =
      limpiar(
        sesion.responsableAsignado
      );

    if (!asesor) {
      return {
        ok: true,
        notificaciones: [],
        ahoraMs:
          Date.now()
      };
    }

    const hoja =
      obtenerOCrearHojaHistorialAsignaciones_();

    if (hoja.getLastRow() < 2) {
      return {
        ok: true,
        notificaciones: [],
        ahoraMs:
          Date.now()
      };
    }

    const ultimaFila =
      hoja.getLastRow();

    const cantidad =
      Math.min(
        150,
        ultimaFila - 1
      );

    const inicio =
      ultimaFila -
      cantidad +
      1;

    const valores =
      hoja
        .getRange(
          inicio,
          1,
          cantidad,
          Math.min(
            8,
            hoja.getLastColumn()
          )
        )
        .getValues();

    const limite =
      Number(
        despuesDeMs || 0
      );

    const notificaciones = [];

    valores.forEach(
      fila => {
        const fecha =
          parsearFechaFlexible(
            fila[0]
          );

        const fechaMs =
          fecha
            ? fecha.getTime()
            : 0;

        const origen =
          normalizar(
            fila[3]
          );

        const asesorFila =
          limpiar(
            fila[4]
          );

        if (
          fechaMs > limite &&
          normalizar(asesorFila) ===
            normalizar(asesor) &&
          V11_ORIGENES_AUTOMATICOS
            .includes(origen)
        ) {
          notificaciones.push({
            fechaMs,
            numero:
              limpiar(fila[1]),
            ticket:
              limpiar(fila[2]),
            origen,
            asesor:
              asesorFila
          });
        }
      }
    );

    notificaciones.sort(
      (a, b) =>
        a.fechaMs - b.fechaMs
    );

    return {
      ok: true,
      asesor,
      notificaciones,
      ahoraMs:
        Date.now()
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message,
      notificaciones: [],
      ahoraMs:
        Date.now()
    };
  }
}
