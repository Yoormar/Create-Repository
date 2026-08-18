/* ========================================================= 
   ACTUALIZACIÓN OPERATIVA RÁPIDA DEL DASHBOARD 
========================================================= */ 
 
/* 
 * Determina si el asesor presenta realmente 
 * una alerta de asignación. 
 * 
 * No considera como alerta a los asesores 
 * deshabilitados o inactivos. 
 */ 
function dashboardRapidoEsAlerta_( 
  item 
) { 
  if ( 
    !item || 
    !item.activo || 
    !item.habilitado 
  ) { 
    return false; 
  } 
 
  const revisiones = 
    Number( 
      item.revision || 0 
    ); 
 
  const complementarios = 
    ( 
      item.ticketsAfectados || 
      [] 
    ) 
      .filter( 
        ticket => 
          normalizar( 
            ticket.fuente 
          ) === 
            'SEGUIMIENTO' && 
          [ 
            'ATENDIDO', 
            'SEGUIMIENTO' 
          ].includes( 
            normalizar( 
              ticket.detalle 
            ) 
          ) 
      ) 
      .length; 
 
  return ( 
    revisiones >= 2 || 
    ( 
      revisiones >= 1 && 
      complementarios >= 1 
    ) 
  ); 
} 
 
 
/* 
 * Construye las alertas utilizando únicamente 
 * la información necesaria para la asignación. 
 */ 
function dashboardRapidoCrearAlertas_( 
  disponibilidad, 
  todos 
) { 
  const porNumero = {}; 
  const porTicket = {}; 
 
  ( 
    todos || 
    [] 
  ).forEach( 
    ticket => { 
      if ( 
        ticket.numero !== undefined && 
        ticket.numero !== null 
      ) { 
        porNumero[ 
          String(ticket.numero) 
        ] = ticket; 
      } 
 
      if (ticket.ticket) { 
        porTicket[ 
          String(ticket.ticket) 
        ] = ticket; 
      } 
    } 
  ); 
 
  return ( 
    disponibilidad || 
    [] 
  ) 
    .filter( 
      dashboardRapidoEsAlerta_ 
    ) 
    .map( 
      item => { 
        const revisiones = 
          Number( 
            item.revision || 0 
          ); 
 
        const motivo = 
          revisiones >= 2 
            ? `${revisiones} tickets En revisión simultáneos` 
            : 'En revisión combinado con Atendido o Seguimiento'; 
 
        const vistos = {}; 
 
        const ticketsAfectados = 
          ( 
            item.ticketsAfectados || 
            [] 
          ) 
            .map( 
              afectado => { 
                const base = 
                  porNumero[ 
                    String( 
                      afectado.numero || '' 
                    ) 
                  ] || 
                  porTicket[ 
                    String( 
                      afectado.ticket || '' 
                    ) 
                  ] || 
                  null; 
 
                const resultado = { 
                  numero: 
                    base 
                      ? base.numero 
                      : afectado.numero || '', 
 
                  ticket: 
                    afectado.ticket || 
                    ( 
                      base 
                        ? base.ticket 
                        : '' 
                    ), 
 
                  alumno: 
                    afectado.alumno || 
                    ( 
                      base 
                        ? base.alumno 
                        : '' 
                    ), 
 
                  detalle: 
                    afectado.detalle || 
                    ( 
                      base 
                        ? base.detalle 
                        : '' 
                    ), 
 
                  plataforma: 
                    base 
                      ? base.origen 
                      : afectado.plataforma || 
                        afectado.fuente || 
                        '', 
 
                  tipoTicket: 
                    base 
                      ? base.tipoTicket 
                      : '' 
                }; 
 
                const clave = 
                  [ 
                    resultado.numero, 
                    resultado.ticket, 
                    resultado.detalle, 
                    resultado.plataforma 
                  ].join('|'); 
 
                if (vistos[clave]) { 
                  return null; 
                } 
 
                vistos[clave] = 
                  true; 
 
                return resultado; 
              } 
            ) 
            .filter(Boolean); 
 
        return { 
          asesor: 
            item.asesor, 
 
          motivo, 
 
          ticketsAfectados 
        }; 
      } 
    ); 
} 
 
 
/* ========================================================= 
   SERVICIO RÁPIDO PARA EL CLIENTE 
========================================================= */ 
 
function obtenerDashboardOperativoRapido( 
  token 
) { 
  try { 
    const validacion = 
      validarAdmin(token); 
 
    if (!validacion.ok) { 
      return validacion; 
    } 
 
    /* 
     * Solo se leen las hojas necesarias: 
     * 
     * - BASE_TICKETS 
     * - SEGUIMIENTO 
     * - USUARIOS 
     * - ALERTAS_PORTAL 
     * 
     * No calcula gráficos, ranking, 
     * evolución, campus ni calendario. 
     */ 
    const base = 
      leerTicketsBase(); 
 
    const todos = 
      base.tickets || []; 
 
    const seguimiento = 
      leerSeguimientoOperativo_(); 
 
    const disponibilidad = 
      obtenerDisponibilidad( 
        todos, 
        seguimiento 
      ); 
 
    const pendientesAsignacionZendesk = 
      todos 
        .filter( 
          ticket => 
            normalizar( 
              ticket.origen 
            ) === 
              'ZENDESK' && 
            !limpiar( 
              ticket.responsable 
            ) && 
            esTicketActivoParaCarga_( 
              ticket 
            ) 
        ) 
        .map( 
          ticket => ({ 
            numero: 
              ticket.numero, 
 
            ticket: 
              ticket.ticket, 
 
            alumno: 
              ticket.alumno, 
 
            tipoTicket: 
              ticket.tipoTicket, 
 
            antecedente: 
              null 
          }) 
        ); 
 
    const alertasAsignacion = 
      dashboardRapidoCrearAlertas_( 
        disponibilidad, 
        todos 
      ); 
 
    const siguienteAsesor = 
      seleccionarSiguienteAsesor( 
        '', 
        disponibilidad 
      ); 
 
    const alertasPortal = 
      typeof leerAlertasPortalPendientes_ === 
        'function' 
        ? leerAlertasPortalPendientes_() 
        : []; 
 
    return { 
      ok: true, 
 
      disponibilidad, 
 
      disponibles: 
        disponibilidad 
          .filter( 
            item => 
              item.disponible 
          ) 
          .length, 
 
      siguienteAsesor, 
 
      pendientesAsignacionZendesk, 
 
      alertasAsignacion, 
 
      alertasPortal: { 
        total: 
          alertasPortal.length, 
 
        pendientes: 
          alertasPortal, 
 
        responsables: 
          disponibilidad 
      }, 
 
      fechaActualizacion: 
        Utilities.formatDate( 
          new Date(), 
          Session.getScriptTimeZone(), 
          'dd/MM/yyyy HH:mm:ss' 
        ) 
    }; 
 
  } catch (error) { 
    return { 
      ok: false, 
 
      message: 
        error.message 
    }; 
  } 
}