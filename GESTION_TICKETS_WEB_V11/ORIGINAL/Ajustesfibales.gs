const AJUSTES_PROP_CALENDARIO =
  'CONFIGURACION_SEMANAL_TICKETS_V2';

const AJUSTES_HORA_CORTE_MINUTOS =
  18 * 60 + 30;

const AJUSTES_DIAS_SEMANA = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO'
];


/* =========================================================
   CONFIGURACIÓN SEMANAL
========================================================= */

function obtenerConfiguracionSemanalInterna_() {
  const configuracionPredeterminada = {
    LUNES: true,
    MARTES: true,
    MIERCOLES: true,
    JUEVES: true,
    VIERNES: true,
    SABADO: false,
    DOMINGO: false
  };

  const propiedad =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        AJUSTES_PROP_CALENDARIO
      );

  if (!propiedad) {
    return configuracionPredeterminada;
  }

  try {
    const configuracion =
      JSON.parse(propiedad);

    return {
      LUNES:
        configuracion.LUNES !== false,

      MARTES:
        configuracion.MARTES !== false,

      MIERCOLES:
        configuracion.MIERCOLES !== false,

      JUEVES:
        configuracion.JUEVES !== false,

      VIERNES:
        configuracion.VIERNES !== false,

      SABADO:
        configuracion.SABADO === true,

      DOMINGO:
        configuracion.DOMINGO === true
    };

  } catch (error) {
    return configuracionPredeterminada;
  }
}


function obtenerConfiguracionSemanal(token) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    return {
      ok: true,

      configuracion:
        obtenerConfiguracionSemanalInterna_()
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


function guardarConfiguracionSemanal(
  token,
  datos
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const noLaborables =
      Array.isArray(
        datos &&
        datos.noLaborables
      )
        ? datos.noLaborables
            .map(normalizar)
        : [];

    const configuracion = {
      LUNES:
        !noLaborables.includes(
          'LUNES'
        ),

      MARTES:
        !noLaborables.includes(
          'MARTES'
        ),

      MIERCOLES:
        !noLaborables.includes(
          'MIERCOLES'
        ),

      JUEVES:
        !noLaborables.includes(
          'JUEVES'
        ),

      VIERNES:
        !noLaborables.includes(
          'VIERNES'
        ),

      SABADO:
        !noLaborables.includes(
          'SABADO'
        ),

      DOMINGO:
        !noLaborables.includes(
          'DOMINGO'
        )
    };

    const cantidadLaborables =
      Object
        .values(configuracion)
        .filter(Boolean)
        .length;

    if (!cantidadLaborables) {
      throw new Error(
        'Debe existir por lo menos un día laborable'
      );
    }

    PropertiesService
      .getScriptProperties()
      .setProperty(
        AJUSTES_PROP_CALENDARIO,
        JSON.stringify(
          configuracion
        )
      );

    return {
      ok: true,
      configuracion,

      message:
        'Configuración semanal guardada correctamente'
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
   FECHA OPERATIVA
========================================================= */

function ajustesEsDiaLaborable_(
  fecha,
  configuracion
) {
  const nombreDia =
    AJUSTES_DIAS_SEMANA[
      fecha.getDay()
    ];

  return Boolean(
    configuracion[
      nombreDia
    ]
  );
}


function calcularFechaOperativaSemanalFinal_(
  fechaHora
) {
  const fecha =
    parsearFechaFlexible(
      fechaHora
    );

  if (!fecha) {
    return null;
  }

  const configuracion =
    obtenerConfiguracionSemanalInterna_();

  const fechaOperativa =
    new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate(),
      0,
      0,
      0,
      0
    );

  const minutosActuales =
    fecha.getHours() * 60 +
    fecha.getMinutes();

  /*
   * A las 18:30 exactas o después
   * se asigna el siguiente día.
   */
  if (
    minutosActuales >=
    AJUSTES_HORA_CORTE_MINUTOS
  ) {
    fechaOperativa.setDate(
      fechaOperativa.getDate() + 1
    );
  }

  let intentos = 0;

  while (
    !ajustesEsDiaLaborable_(
      fechaOperativa,
      configuracion
    )
  ) {
    fechaOperativa.setDate(
      fechaOperativa.getDate() + 1
    );

    intentos++;

    if (intentos > 14) {
      throw new Error(
        'No se encontró un día laborable en la configuración semanal'
      );
    }
  }

  return fechaOperativa;
}


function esDetalleCierreFinal_(detalle) {
  return [
    'ATENDIDO',
    'DERIVADO',
    'CERRADO'
  ].includes(
    normalizar(detalle)
  );
}


/* =========================================================
   ACTUALIZAR FECHA FIN
========================================================= */

function aplicarFechaFinSemanalFinal_(
  numero,
  fechaHora
) {
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
      'No se encontró el ticket para actualizar la fecha operativa'
    );
  }

  const fechaFinOperativa =
    calcularFechaOperativaSemanalFinal_(
      fechaHora || new Date()
    );

  escribirPorEncabezado_(
    base.hoja,
    base.mapa,
    ticket.rowNumber,
    'FECHA FIN',
    fechaFinOperativa
  );

  const columnaFechaFin =
    base.mapa[
      normalizar(
        'FECHA FIN'
      )
    ];

  if (columnaFechaFin) {
    base.hoja
      .getRange(
        ticket.rowNumber,
        columnaFechaFin
      )
      .setNumberFormat(
        'dd/MM/yyyy'
      );
  }

  return fechaFinOperativa;
}


/* =========================================================
   GUARDADO PARA ADMINISTRADOR
========================================================= */

function guardarTicketAdminFlexibleFinal_(
  token,
  datos,
  sesion
) {
  const lock =
    LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const numero =
      limpiar(
        datos &&
        datos.numero
      );

    if (!numero) {
      throw new Error(
        'No se identificó el ticket'
      );
    }

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
        'No se encontró el ticket'
      );
    }

    const fila =
      ticket.rowNumber;

    const ahora =
      new Date();

    const tipoTicket =
      normalizar(
        ticket.tipoTicket
      );

    const detalle =
      limpiar(
        datos &&
        datos.detalle
      ) ||
      ticket.detalle;

    /*
     * El administrador puede guardar
     * aunque existan campos incompletos.
     */

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'DNI',
      limpiar(
        datos &&
        datos.dni
      )
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'ALUMNOS2',
      limpiar(
        datos &&
        datos.alumno
      )
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'CAMPUS',
      limpiar(
        datos &&
        datos.campus
      )
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'TIPO DE INGRESO',
      limpiar(
        datos &&
        datos.tipoIngreso
      )
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'TIPO DE CONVALIDACIÓN',
      limpiar(
        datos &&
        datos.tipoConvalidacion
      )
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'TIPO DE REEVALUACIÓN',
      tipoTicket === 'REEVALUADO'
        ? limpiar(
            datos &&
            datos.tipoReevaluacion
          )
        : ''
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'Detalle',
      detalle
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'Observación',
      limpiar(
        datos &&
        datos.observacion
      )
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'Responsable',
      limpiar(
        datos &&
        datos.responsable
      )
    );

    if (
      !limpiar(
        ticket.tiempoInicio
      )
    ) {
      escribirPorEncabezado_(
        base.hoja,
        base.mapa,
        fila,
        'TIEMPO INICIO',
        ahora
      );
    }

    if (
      esDetalleCierreFinal_(
        detalle
      )
    ) {
      escribirPorEncabezado_(
        base.hoja,
        base.mapa,
        fila,
        'TIEMPO FIN',
        ahora
      );

      const fechaFinOperativa =
        calcularFechaOperativaSemanalFinal_(
          ahora
        );

      escribirPorEncabezado_(
        base.hoja,
        base.mapa,
        fila,
        'FECHA FIN',
        fechaFinOperativa
      );

      const columnaFechaFin =
        base.mapa[
          normalizar(
            'FECHA FIN'
          )
        ];

      if (columnaFechaFin) {
        base.hoja
          .getRange(
            fila,
            columnaFechaFin
          )
          .setNumberFormat(
            'dd/MM/yyyy'
          );
      }

      const fechaInicio =
        parsearFechaFlexible(
          ticket.tiempoInicioRaw ||
          ticket.tiempoInicio ||
          ahora
        );

      const tiempoTotal =
        calcularMilisegundosLaborales_(
          fechaInicio,
          ahora
        );

      escribirPorEncabezado_(
        base.hoja,
        base.mapa,
        fila,
        'TIEMPO TOTAL',
        formatearDuracion(
          tiempoTotal
        )
      );
    }

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'FECHA ACTUALIZACIÓN',
      ahora
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'N° DE CAMBIOS',
      Number(
        ticket.numeroCambios ||
        0
      ) + 1
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'USUARIO ÚLTIMA MODIFICACIÓN',
      sesion.usuario
    );

    resolverAlertasDatosCompletados();

    SpreadsheetApp.flush();

    const actualizado =
      leerTicketsBase()
        .tickets
        .find(
          item =>
            String(item.numero) ===
            String(numero)
        );

    return {
      ok: true,

      message:
        esDetalleCierreFinal_(
          detalle
        )
          ? 'Ticket atendido y guardado correctamente'
          : 'Ticket actualizado correctamente',

      ticket:
        serializarTicketParaCliente_(
          actualizado
        )
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


/* =========================================================
   GUARDADO FINAL
========================================================= */

function guardarTicketFinal(
  token,
  datos
) {
  try {
    const validacion =
      validarSesion(token);

    if (!validacion.ok) {
      return validacion;
    }

    const esAdmin =
      validacion.sesion.rol ===
      'ADMIN';

    /*
     * El administrador utiliza un
     * guardado flexible.
     */
    if (esAdmin) {
      return guardarTicketAdminFlexibleFinal_(
        token,
        datos,
        validacion.sesion
      );
    }

    /*
     * El asesor mantiene la validación
     * obligatoria original.
     */
    const resultado =
      guardarTicket(
        token,
        datos
      );

    if (
      !resultado ||
      !resultado.ok
    ) {
      return resultado;
    }

    if (
      esDetalleCierreFinal_(
        datos &&
        datos.detalle
      )
    ) {
      const fechaOperativa =
        aplicarFechaFinSemanalFinal_(
          datos.numero,
          new Date()
        );

      SpreadsheetApp.flush();

      const actualizado =
        leerTicketsBase()
          .tickets
          .find(
            item =>
              String(item.numero) ===
              String(datos.numero)
          );

      return {
        ok: true,

        message:
          `Ticket atendido. Fecha operativa: ${
            Utilities.formatDate(
              fechaOperativa,
              Session.getScriptTimeZone(),
              'dd/MM/yyyy'
            )
          }`,

        ticket:
          serializarTicketParaCliente_(
            actualizado
          )
      };
    }

    return resultado;

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


/* =========================================================
   REPORTE PORTAL
========================================================= */

function reportarTicketPortalFinal(
  token,
  numero
) {
  return reportarTicketPortal(
    token,
    numero
  );
}


/* =========================================================
   REASIGNACIÓN PORTAL
========================================================= */

function reasignarAlertaPortalFinal(
  token,
  idAlerta,
  asesorManual
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const asesorSeleccionado =
      limpiar(asesorManual);

    /*
     * Si el administrador seleccionó
     * manualmente al responsable anterior,
     * se respeta esa selección.
     */
    if (asesorSeleccionado) {
      return reasignarAlertaPortal(
        token,
        idAlerta,
        asesorSeleccionado
      );
    }

    /*
     * En la asignación automática ya no
     * se excluye al responsable anterior.
     */
    const recomendado =
      seleccionarSiguienteAsesor(
        ''
      );

    if (!recomendado) {
      throw new Error(
        'No hay asesores disponibles'
      );
    }

    return reasignarAlertaPortal(
      token,
      idAlerta,
      recomendado.asesor
    );

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


function procesarAlertasPortalAutomaticasFinal(
  token
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const pendientes =
      leerAlertasPortalPendientes_();

    let procesadas = 0;

    const errores = [];

    pendientes.forEach(
      alerta => {
        const resultado =
          reasignarAlertaPortalFinal(
            token,
            alerta.id,
            ''
          );

        if (
          resultado &&
          resultado.ok
        ) {
          procesadas++;

        } else {
          errores.push(
            `Ticket ${
              alerta.ticket ||
              alerta.numero
            }: ${
              resultado
                ? resultado.message
                : 'Error'
            }`
          );
        }
      }
    );

    return {
      ok: true,
      procesadas,
      errores,

      message:
        `${procesadas} ticket(s) Portal reasignado(s)`
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

function probarFechaOperativaSemanalFinal() {
  const viernesDespuesDelCorte =
    new Date(
      2026,
      6,
      24,
      18,
      30,
      0
    );

  const resultado =
    calcularFechaOperativaSemanalFinal_(
      viernesDespuesDelCorte
    );

  Logger.log(
    Utilities.formatDate(
      resultado,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy'
    )
  );

  return resultado;
}
