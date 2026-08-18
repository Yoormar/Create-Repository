/* ========================================================= 
   AJUSTE FINAL DE CIERRE Y FECHA FIN 
========================================================= */ 
 
function ajusteEsAtendido_(detalle) { 
  return normalizar(detalle) === 
    'ATENDIDO'; 
} 
 
 
function ajusteCalcularFechaFinConHora_( 
  fechaHora 
) { 
  const ahora = 
    parsearFechaFlexible( 
      fechaHora 
    ) || new Date(); 
 
  let fechaOperativa = null; 
 
  /* 
   * Utiliza primero la configuración 
   * semanal creada en AjustesFinales.gs. 
   */ 
  if ( 
    typeof calcularFechaOperativaSemanalFinal_ === 
    'function' 
  ) { 
    fechaOperativa = 
      calcularFechaOperativaSemanalFinal_( 
        ahora 
      ); 
 
  } else if ( 
    typeof calcularFechaOperativa_ === 
    'function' 
  ) { 
    fechaOperativa = 
      calcularFechaOperativa_( 
        ahora 
      ); 
  } 
 
  if (!fechaOperativa) { 
    fechaOperativa = 
      new Date(ahora); 
  } 
 
  /* 
   * Conserva la fecha laborable calculada, 
   * pero agrega la hora real del guardado. 
   * 
   * Ejemplo: 
   * 27/07/2026 18:45:32 
   */ 
  fechaOperativa.setHours( 
    ahora.getHours(), 
    ahora.getMinutes(), 
    ahora.getSeconds(), 
    0 
  ); 
 
  return fechaOperativa; 
} 
 
 
function ajusteFormatearColumnaFechaHora_( 
  hoja, 
  mapa, 
  fila, 
  encabezado 
) { 
  const columna = 
    mapa[ 
      normalizar(encabezado) 
    ]; 
 
  if (!columna) { 
    return; 
  } 
 
  hoja 
    .getRange( 
      fila, 
      columna 
    ) 
    .setNumberFormat( 
      'dd/MM/yyyy HH:mm:ss' 
    ); 
} 
 
 
function ajusteLimpiarCierreTicket_( 
  hoja, 
  mapa, 
  fila 
) { 
  /* 
   * Al reabrir un ticket se eliminan 
   * los datos del cierre anterior. 
   */ 
  [ 
    'FECHA FIN', 
    'TIEMPO FIN', 
    'TIEMPO TOTAL' 
  ].forEach( 
    encabezado => { 
      const columna = 
        mapa[ 
          normalizar(encabezado) 
        ]; 
 
      if (columna) { 
        hoja 
          .getRange( 
            fila, 
            columna 
          ) 
          .clearContent(); 
      } 
    } 
  ); 
} 
 
 
/* ========================================================= 
   GUARDADO FINAL V3 
========================================================= */ 
 
function guardarTicketFinalHoraV3( 
  token, 
  datos 
) { 
  try { 
    const validacion = 
      validarSesion(token); 
 
    if (!validacion.ok) { 
      return validacion; 
    } 
 
    const sesion = 
      validacion.sesion; 
 
    const esAdmin = 
      sesion.rol === 
      'ADMIN'; 
 
    /* 
     * Se utiliza la función anterior para 
     * conservar permisos, alertas y reglas. 
     */ 
    let resultadoBase; 
 
    if ( 
      typeof guardarTicketFinal === 
      'function' 
    ) { 
      resultadoBase = 
        guardarTicketFinal( 
          token, 
          datos 
        ); 
 
    } else { 
      resultadoBase = 
        guardarTicket( 
          token, 
          datos 
        ); 
    } 
 
    if ( 
      !resultadoBase || 
      !resultadoBase.ok 
    ) { 
      return resultadoBase; 
    } 
 
    const numero = 
      limpiar( 
        datos && 
        datos.numero 
      ); 
 
    const base = 
      leerTicketsBase(); 
 
    const ticket = 
      base.tickets.find( 
        item => 
          String(item.numero) === 
          String(numero) 
      ); 
 
    if (!ticket) { 
      throw new Error( 
        'El ticket se guardó, pero no se pudo volver a localizar' 
      ); 
    } 
 
    const detalleFinal = 
      limpiar( 
        datos && 
        datos.detalle 
      ) || 
      ticket.detalle; 
 
    const ahora = 
      new Date(); 
 
    let fechaFinOperativa = null; 
 
    /* 
     * Solo Atendido genera fecha de cierre. 
     */ 
    if ( 
      ajusteEsAtendido_( 
        detalleFinal 
      ) 
    ) { 
      fechaFinOperativa = 
        ajusteCalcularFechaFinConHora_( 
          ahora 
        ); 
 
      escribirPorEncabezado_( 
        base.hoja, 
        base.mapa, 
        ticket.rowNumber, 
        'TIEMPO FIN', 
        ahora 
      ); 
 
      escribirPorEncabezado_( 
        base.hoja, 
        base.mapa, 
        ticket.rowNumber, 
        'FECHA FIN', 
        fechaFinOperativa 
      ); 
 
      ajusteFormatearColumnaFechaHora_( 
        base.hoja, 
        base.mapa, 
        ticket.rowNumber, 
        'TIEMPO FIN' 
      ); 
 
      ajusteFormatearColumnaFechaHora_( 
        base.hoja, 
        base.mapa, 
        ticket.rowNumber, 
        'FECHA FIN' 
      ); 
 
    /* 
     * Si el administrador cambia Atendido 
     * por otro detalle, se elimina el cierre. 
     */ 
    } else if (esAdmin) { 
      ajusteLimpiarCierreTicket_( 
        base.hoja, 
        base.mapa, 
        ticket.rowNumber 
      ); 
    } 
 
    escribirPorEncabezado_( 
      base.hoja, 
      base.mapa, 
      ticket.rowNumber, 
      'FECHA ACTUALIZACIÓN', 
      ahora 
    ); 
 
    SpreadsheetApp.flush(); 
 
    const actualizado = 
      leerTicketsBase() 
        .tickets 
        .find( 
          item => 
            String(item.numero) === 
            String(numero) 
        ); 
 
    let mensaje = 
      'Ticket actualizado correctamente'; 
 
    if ( 
      ajusteEsAtendido_( 
        detalleFinal 
      ) && 
      fechaFinOperativa 
    ) { 
      mensaje = 
        `Ticket atendido. Fecha fin: ${ 
          Utilities.formatDate( 
            fechaFinOperativa, 
            Session.getScriptTimeZone(), 
            'dd/MM/yyyy HH:mm:ss' 
          ) 
        }`; 
 
    } else if (esAdmin) { 
      mensaje = 
        'Ticket actualizado. Los datos de cierre se limpiaron porque el detalle no es Atendido.'; 
    } 
 
    return { 
      ok: true, 
      message: mensaje, 
 
      ticket: 
        typeof serializarTicketParaCliente_ === 
        'function' 
          ? serializarTicketParaCliente_( 
              actualizado 
            ) 
          : actualizado 
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
   PRUEBA 
========================================================= */ 
 
function probarFechaFinConHoraV3() { 
  const prueba = 
    new Date( 
      2026, 
      6, 
      24, 
      18, 
      30, 
      25 
    ); 
 
  const resultado = 
    ajusteCalcularFechaFinConHora_( 
      prueba 
    ); 
 
  const texto = 
    Utilities.formatDate( 
      resultado, 
      Session.getScriptTimeZone(), 
      'dd/MM/yyyy HH:mm:ss' 
    ); 
 
  Logger.log(texto); 
 
  return texto; 
}