/* =========================================================
   DASHBOARD GERENCIAL
   Archivo: DashboardGerencial.gs

   Este dashboard es independiente del dashboard operativo.
   Solo se procesa cuando se abre la vista gerencial.
========================================================= */

var DG_CACHE_SEGUNDOS = 120;


/* =========================================================
   UTILIDADES
========================================================= */

function dgLimpiar_(valor) {
  if (
    typeof limpiar ===
    'function'
  ) {
    return limpiar(valor);
  }

  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function dgNormalizar_(valor) {
  if (
    typeof normalizar ===
    'function'
  ) {
    return normalizar(valor);
  }

  return dgLimpiar_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(/\s+/g, ' ')
    .toUpperCase();
}


function dgFecha_(valor) {
  if (
    valor instanceof Date &&
    !isNaN(valor.getTime())
  ) {
    return new Date(
      valor.getTime()
    );
  }

  if (
    typeof parsearFechaFlexible ===
    'function'
  ) {
    const fecha =
      parsearFechaFlexible(valor);

    if (fecha) {
      return fecha;
    }
  }

  const texto =
    dgLimpiar_(valor);

  if (!texto) {
    return null;
  }

  const formatoPeru =
    texto.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

  if (formatoPeru) {
    const fecha =
      new Date(
        Number(formatoPeru[3]),
        Number(formatoPeru[2]) - 1,
        Number(formatoPeru[1]),
        Number(formatoPeru[4] || 0),
        Number(formatoPeru[5] || 0),
        Number(formatoPeru[6] || 0)
      );

    return isNaN(
      fecha.getTime()
    )
      ? null
      : fecha;
  }

  const formatoIso =
    texto.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
    );

  if (formatoIso) {
    const fecha =
      new Date(
        Number(formatoIso[1]),
        Number(formatoIso[2]) - 1,
        Number(formatoIso[3]),
        Number(formatoIso[4] || 0),
        Number(formatoIso[5] || 0),
        Number(formatoIso[6] || 0)
      );

    return isNaN(
      fecha.getTime()
    )
      ? null
      : fecha;
  }

  const fecha =
    new Date(texto);

  return isNaN(
    fecha.getTime()
  )
    ? null
    : fecha;
}

function dgTienePropiedad_(
  objeto,
  propiedad
) {
  return Boolean(objeto) &&
    Object.prototype
      .hasOwnProperty
      .call(
        objeto,
        propiedad
      );
}


function dgFechaTicket_(ticket) {
  if (!ticket) {
    return null;
  }

  if (
    dgTienePropiedad_(
      ticket,
      '__dgFechaRegistro'
    )
  ) {
    return ticket.__dgFechaRegistro;
  }

  ticket.__dgFechaRegistro =
    dgFecha_(
      ticket.registroRaw ||
      ticket.registro ||
      ticket.fechaInicioRaw ||
      ticket.fechaInicio
    );

  return ticket.__dgFechaRegistro;
}


function dgFechaFinTicket_(ticket) {
  if (!ticket) {
    return null;
  }

  if (
    dgTienePropiedad_(
      ticket,
      '__dgFechaFin'
    )
  ) {
    return ticket.__dgFechaFin;
  }

  ticket.__dgFechaFin =
    dgFecha_(
      ticket.fechaFinRaw ||
      ticket.fechaFin ||
      ticket.tiempoFinRaw ||
      ticket.tiempoFin
    );

  return ticket.__dgFechaFin;
}


function dgFechaActualizacionTicket_(
  ticket
) {
  if (!ticket) {
    return null;
  }

  if (
    dgTienePropiedad_(
      ticket,
      '__dgFechaActualizacion'
    )
  ) {
    return ticket
      .__dgFechaActualizacion;
  }

  ticket.__dgFechaActualizacion =
    dgFecha_(
      ticket.fechaActualizacion ||
      ticket.tiempoFinRaw ||
      ticket.tiempoFin
    );

  return ticket
    .__dgFechaActualizacion;
}


/*
 * Formato rápido de fechas.
 *
 * Evita ejecutar Utilities.formatDate()
 * miles de veces durante una sola carga.
 */
function dgDosDigitos_(numero) {
  return String(
    Number(numero || 0)
  ).padStart(
    2,
    '0'
  );
}


function dgPartesFecha_(fecha) {
  if (
    !(fecha instanceof Date) ||
    isNaN(fecha.getTime())
  ) {
    return null;
  }

  return {
    anio:
      fecha.getFullYear(),

    mes:
      fecha.getMonth() + 1,

    dia:
      fecha.getDate(),

    hora:
      fecha.getHours(),

    minuto:
      fecha.getMinutes()
  };
}


function dgClaveFecha_(fecha) {
  const partes =
    dgPartesFecha_(fecha);

  if (!partes) {
    return '';
  }

  return (
    `${partes.anio}-` +
    `${dgDosDigitos_(
      partes.mes
    )}-` +
    `${dgDosDigitos_(
      partes.dia
    )}`
  );
}


function dgEtiquetaFecha_(fecha) {
  const partes =
    dgPartesFecha_(fecha);

  if (!partes) {
    return '';
  }

  return (
    `${dgDosDigitos_(
      partes.dia
    )}/` +
    `${dgDosDigitos_(
      partes.mes
    )}/` +
    `${partes.anio}`
  );
}


function dgEtiquetaFechaHora_(fecha) {
  const partes =
    dgPartesFecha_(fecha);

  if (!partes) {
    return '';
  }

  return (
    `${dgDosDigitos_(
      partes.dia
    )}/` +
    `${dgDosDigitos_(
      partes.mes
    )}/` +
    `${partes.anio} ` +
    `${dgDosDigitos_(
      partes.hora
    )}:` +
    `${dgDosDigitos_(
      partes.minuto
    )}`
  );
}


function dgClaveMes_(fecha) {
  const partes =
    dgPartesFecha_(fecha);

  if (!partes) {
    return '';
  }

  return (
    `${partes.anio}-` +
    `${dgDosDigitos_(
      partes.mes
    )}`
  );
}


function dgEtiquetaMes_(fecha) {
  const partes =
    dgPartesFecha_(fecha);

  if (!partes) {
    return '';
  }

  return (
    `${dgDosDigitos_(
      partes.mes
    )}/` +
    `${partes.anio}`
  );
}


/* =========================================================
   ESTADO DEL TICKET
========================================================= */

function dgDetalleNormalizado_(
  ticket
) {
  if (!ticket) {
    return '';
  }

  if (
    dgTienePropiedad_(
      ticket,
      '__dgDetalleNormalizado'
    )
  ) {
    return ticket
      .__dgDetalleNormalizado;
  }

  ticket.__dgDetalleNormalizado =
    dgNormalizar_(
      ticket.detalle
    );

  return ticket
    .__dgDetalleNormalizado;
}


function dgEstadoNormalizado_(
  ticket
) {
  if (!ticket) {
    return '';
  }

  if (
    dgTienePropiedad_(
      ticket,
      '__dgEstadoNormalizado'
    )
  ) {
    return ticket
      .__dgEstadoNormalizado;
  }

  ticket.__dgEstadoNormalizado =
    dgNormalizar_(
      ticket.estado
    );

  return ticket
    .__dgEstadoNormalizado;
}


function dgEsAtendido_(ticket) {
  if (!ticket) {
    return false;
  }

  if (
    dgTienePropiedad_(
      ticket,
      '__dgEsAtendido'
    )
  ) {
    return ticket.__dgEsAtendido;
  }

  const detalle =
    dgDetalleNormalizado_(
      ticket
    );

  const estado =
    dgEstadoNormalizado_(
      ticket
    );

  ticket.__dgEsAtendido =
    [
      'ATENDIDO',
      'CERRADO'
    ].includes(detalle) ||
    estado === 'CERRADO';

  return ticket.__dgEsAtendido;
}


function dgEsActivo_(ticket) {
  if (!ticket) {
    return false;
  }

  if (
    dgTienePropiedad_(
      ticket,
      '__dgEsActivo'
    )
  ) {
    return ticket.__dgEsActivo;
  }

  const detalle =
    dgDetalleNormalizado_(
      ticket
    );

  const estado =
    dgEstadoNormalizado_(
      ticket
    );

  ticket.__dgEsActivo =
    ![
      'ATENDIDO',
      'DERIVADO',
      'CERRADO'
    ].includes(detalle) &&
    estado !== 'CERRADO';

  return ticket.__dgEsActivo;
}


function dgEsReevaluado_(ticket) {
  if (!ticket) {
    return false;
  }

  if (
    dgTienePropiedad_(
      ticket,
      '__dgEsReevaluado'
    )
  ) {
    return ticket.__dgEsReevaluado;
  }

  ticket.__dgEsReevaluado =
    dgNormalizar_(
      ticket.tipoTicket
    ) === 'REEVALUADO';

  return ticket.__dgEsReevaluado;
}

/* =========================================================
   TIEMPOS
========================================================= */

function dgDuracionTextoMs_(valor) {
  const texto =
    dgNormalizar_(valor);

  if (!texto) {
    return 0;
  }

  let minutos = 0;

  const dias =
    texto.match(
      /(\d+(?:[.,]\d+)?)\s*DIA/
    );

  const horas =
    texto.match(
      /(\d+(?:[.,]\d+)?)\s*H/
    );

  const minutosTexto =
    texto.match(
      /(\d+(?:[.,]\d+)?)\s*MIN/
    );

  if (dias) {
    minutos +=
      Number(
        dias[1].replace(',', '.')
      ) * 1440;
  }

  if (horas) {
    minutos +=
      Number(
        horas[1].replace(',', '.')
      ) * 60;
  }

  if (minutosTexto) {
    minutos +=
      Number(
        minutosTexto[1]
          .replace(',', '.')
      );
  }

  return Math.round(
    minutos * 60000
  );
}


function dgDuracionTicketMs_(ticket) {
  if (
    !ticket ||
    !dgEsAtendido_(ticket)
  ) {
    return 0;
  }

  /*
   * Evita calcular varias veces la duración
   * del mismo ticket durante una sola carga.
   */
  if (
    Object.prototype
      .hasOwnProperty
      .call(
        ticket,
        '__dgDuracionMs'
      )
  ) {
    return ticket.__dgDuracionMs;
  }

  /*
   * TIEMPO TOTAL ya fue calculado cuando
   * el ticket fue cerrado.
   */
  let resultado =
    dgDuracionTextoMs_(
      ticket.tiempoTotal
    );

  /*
   * Respaldo para tickets antiguos que no
   * tengan TIEMPO TOTAL.
   */
  if (!(resultado > 0)) {
    const inicio =
      dgFecha_(
        ticket.tiempoInicioRaw ||
        ticket.tiempoInicio
      );

    const fin =
      dgFecha_(
        ticket.tiempoFinRaw ||
        ticket.tiempoFin
      );

    if (
      inicio &&
      fin &&
      fin > inicio
    ) {
      resultado =
        fin.getTime() -
        inicio.getTime();
    }
  }

  ticket.__dgDuracionMs =
    Number.isFinite(resultado) &&
    resultado > 0
      ? resultado
      : 0;

  return ticket.__dgDuracionMs;
}

function dgFormatearDuracion_(ms) {
  if (
    !Number.isFinite(ms) ||
    ms <= 0
  ) {
    return '0 min';
  }

  const minutosTotales =
    Math.round(
      ms / 60000
    );

  const dias =
    Math.floor(
      minutosTotales / 1440
    );

  const horas =
    Math.floor(
      (
        minutosTotales %
        1440
      ) / 60
    );

  const minutos =
    minutosTotales % 60;

  const partes = [];

  if (dias > 0) {
    partes.push(
      `${dias} d`
    );
  }

  if (horas > 0) {
    partes.push(
      `${horas} h`
    );
  }

  if (
    minutos > 0 ||
    !partes.length
  ) {
    partes.push(
      `${minutos} min`
    );
  }

  return partes.join(' ');
}


/* =========================================================
   FILTROS
========================================================= */

function dgPrepararFiltros_(filtros) {
  const entrada =
    filtros || {};

  const desde =
    dgFecha_(
      entrada.fechaDesde
    );

  const hasta =
    dgFecha_(
      entrada.fechaHasta
    );

  if (desde) {
    desde.setHours(
      0,
      0,
      0,
      0
    );
  }

  if (hasta) {
    hasta.setHours(
      23,
      59,
      59,
      999
    );
  }

  return {
    fechaDesde:
      desde,

    fechaHasta:
      hasta,

    campus:
      dgLimpiar_(
        entrada.campus
      ),

    asesor:
      dgLimpiar_(
        entrada.asesor
      ),

    origen:
      dgLimpiar_(
        entrada.origen
      ),

    tipoTicket:
      dgLimpiar_(
        entrada.tipoTicket
      ),

    tipoReevaluacion:
      dgLimpiar_(
        entrada.tipoReevaluacion
      ),

    tipoConvalidacion:
      dgLimpiar_(
        entrada.tipoConvalidacion
      ),

    tipoIngreso:
      dgLimpiar_(
        entrada.tipoIngreso
      ),

    forzar:
      entrada.forzar === true ||
      String(
        entrada.forzar || ''
      ).toLowerCase() ===
        'true'
  };
}


function dgCoincideFiltro_(
  ticket,
  filtros
) {
  const fecha =
    dgFechaTicket_(ticket);

  if (
    filtros.fechaDesde &&
    (
      !fecha ||
      fecha <
        filtros.fechaDesde
    )
  ) {
    return false;
  }

  if (
    filtros.fechaHasta &&
    (
      !fecha ||
      fecha >
        filtros.fechaHasta
    )
  ) {
    return false;
  }

  const comparaciones = [
    [
      filtros.campus,
      ticket.campus
    ],
    [
      filtros.asesor,
      ticket.responsable
    ],
    [
      filtros.origen,
      ticket.origen
    ],
    [
      filtros.tipoTicket,
      ticket.tipoTicket
    ],
    [
      filtros.tipoReevaluacion,
      ticket.tipoReevaluacion
    ],
    [
      filtros.tipoConvalidacion,
      ticket.tipoConvalidacion
    ],
    [
      filtros.tipoIngreso,
      ticket.tipoIngreso
    ]
  ];

  return comparaciones.every(
    datos => {
      const filtro =
        datos[0];

      const valor =
        datos[1];

      if (!filtro) {
        return true;
      }

      return (
        dgNormalizar_(filtro) ===
        dgNormalizar_(valor)
      );
    }
  );
}


function dgFechaDentroPeriodo_(
  fecha,
  filtros
) {
  if (!fecha) {
    return false;
  }

  if (
    filtros.fechaDesde &&
    fecha <
      filtros.fechaDesde
  ) {
    return false;
  }

  if (
    filtros.fechaHasta &&
    fecha >
      filtros.fechaHasta
  ) {
    return false;
  }

  return true;
}


/* =========================================================
   CATÁLOGOS PARA SELECTORES
========================================================= */

function dgCatalogos_(tickets) {
  const datos = {
    campus:
      new Set(),

    asesores:
      new Set(),

    origenes:
      new Set(),

    tiposTicket:
      new Set(),

    tiposReevaluacion:
      new Set(),

    tiposConvalidacion:
      new Set(),

    tiposIngreso:
      new Set(),

    anios:
      new Set()
  };

  tickets.forEach(
    ticket => {
      const agregar = (
        conjunto,
        valor
      ) => {
        const limpio =
          dgLimpiar_(valor);

        if (limpio) {
          conjunto.add(limpio);
        }
      };

      agregar(
        datos.campus,
        ticket.campus
      );

      agregar(
        datos.asesores,
        ticket.responsable
      );

      agregar(
        datos.origenes,
        ticket.origen
      );

      agregar(
        datos.tiposTicket,
        ticket.tipoTicket
      );

      agregar(
        datos.tiposReevaluacion,
        ticket.tipoReevaluacion
      );

      agregar(
        datos.tiposConvalidacion,
        ticket.tipoConvalidacion
      );

      agregar(
        datos.tiposIngreso,
        ticket.tipoIngreso
      );

      const fecha =
        dgFechaTicket_(ticket);

      if (fecha) {
        datos.anios.add(
          fecha.getFullYear()
        );
      }
    }
  );

  const ordenarTexto =
    conjunto =>
      Array
        .from(conjunto)
        .sort(
          (
            a,
            b
          ) =>
            String(a)
              .localeCompare(
                String(b),
                'es',
                {
                  sensitivity:
                    'base'
                }
              )
        );

  return {
    campus:
      ordenarTexto(
        datos.campus
      ),

    asesores:
      ordenarTexto(
        datos.asesores
      ),

    origenes:
      ordenarTexto(
        datos.origenes
      ),

    tiposTicket:
      ordenarTexto(
        datos.tiposTicket
      ),

    tiposReevaluacion:
      ordenarTexto(
        datos.tiposReevaluacion
      ),

    tiposConvalidacion:
      ordenarTexto(
        datos.tiposConvalidacion
      ),

    tiposIngreso:
      ordenarTexto(
        datos.tiposIngreso
      ),

    anios:
      Array
        .from(datos.anios)
        .sort(
          (
            a,
            b
          ) =>
            b - a
        )
  };
}


/* =========================================================
   AGRUPACIONES
========================================================= */

function dgCrearAcumulador_(
  nombre
) {
  return {
    nombre:
      nombre,

    tickets:
      0,

    atendidos:
      0,

    activos:
      0,

    reevaluados:
      0,

    derivados:
      0,

    totalCambios:
      0,

    duracionTotalMs:
      0,

    casosConTiempo:
      0
  };
}


function dgAgregarAlAcumulador_(
  acumulador,
  ticket
) {
  acumulador.tickets++;

  if (
    dgEsAtendido_(ticket)
  ) {
    acumulador.atendidos++;
  }

  if (
    dgEsActivo_(ticket)
  ) {
    acumulador.activos++;
  }

  if (
    dgEsReevaluado_(ticket)
  ) {
    acumulador.reevaluados++;
  }

  if (
    dgNormalizar_(
      ticket.detalle
    ) === 'DERIVADO'
  ) {
    acumulador.derivados++;
  }

  acumulador.totalCambios +=
    Number(
      ticket.numeroCambios || 0
    ) || 0;

  const duracion =
    dgDuracionTicketMs_(
      ticket
    );

  if (duracion > 0) {
    acumulador
      .duracionTotalMs +=
      duracion;

    acumulador
      .casosConTiempo++;
  }
}


function dgFinalizarAcumulador_(
  acumulador
) {
  const promedio =
    acumulador
      .casosConTiempo > 0
      ? acumulador
          .duracionTotalMs /
        acumulador
          .casosConTiempo
      : 0;

  return {
    nombre:
      acumulador.nombre,

    tickets:
      acumulador.tickets,

    atendidos:
      acumulador.atendidos,

    activos:
      acumulador.activos,

    reevaluados:
      acumulador.reevaluados,

    derivados:
      acumulador.derivados,

    porcentajeAtendidos:
      acumulador.tickets > 0
        ? Math.round(
            acumulador.atendidos /
            acumulador.tickets *
            1000
          ) / 10
        : 0,

    totalCambios:
      acumulador.totalCambios,

    promedioCambios:
      acumulador.tickets > 0
        ? Math.round(
            acumulador.totalCambios /
            acumulador.tickets *
            100
          ) / 100
        : 0,

    casosConTiempo:
      acumulador
        .casosConTiempo,

    tiempoPromedioMs:
      Math.round(promedio),

    tiempoPromedio:
      dgFormatearDuracion_(
        promedio
      )
  };
}


function dgAgrupar_(
  tickets,
  obtenerNombre,
  nombreVacio
) {
  const mapa = {};

  tickets.forEach(
    ticket => {
      const nombre =
        dgLimpiar_(
          obtenerNombre(ticket)
        ) ||
        nombreVacio;

      const clave =
        dgNormalizar_(nombre) ||
        'SIN_DATO';

      if (!mapa[clave]) {
        mapa[clave] =
          dgCrearAcumulador_(
            nombre
          );
      }

      dgAgregarAlAcumulador_(
        mapa[clave],
        ticket
      );
    }
  );

  return Object
    .keys(mapa)
    .map(
      clave =>
        dgFinalizarAcumulador_(
          mapa[clave]
        )
    )
    .sort(
      (
        a,
        b
      ) =>
        b.tickets -
          a.tickets ||
        String(a.nombre)
          .localeCompare(
            String(b.nombre),
            'es',
            {
              sensitivity:
                'base'
            }
          )
    );
}


/* =========================================================
   TENDENCIAS
========================================================= */

function dgAgregarTendencia_(
  mapa,
  fecha,
  campo,
  tipo
) {
  if (!fecha) {
    return;
  }

  const clave =
    tipo === 'MES'
      ? dgClaveMes_(fecha)
      : dgClaveFecha_(fecha);

  if (!clave) {
    return;
  }

  if (!mapa[clave]) {
    mapa[clave] = {
      clave:
        clave,

      fecha:
        tipo === 'MES'
          ? dgEtiquetaMes_(fecha)
          : dgEtiquetaFecha_(fecha),

      ingresados:
        0,

      atendidos:
        0,

      actualizados:
        0
    };
  }

  mapa[clave][campo]++;
}


function dgConstruirTendencias_(
  tickets,
  filtros
) {
  const diario = {};
  const mensual = {};

  tickets.forEach(
    ticket => {
      const fechaRegistro =
        dgFechaTicket_(ticket);

      if (
        dgFechaDentroPeriodo_(
          fechaRegistro,
          filtros
        )
      ) {
        dgAgregarTendencia_(
          diario,
          fechaRegistro,
          'ingresados',
          'DIA'
        );

        dgAgregarTendencia_(
          mensual,
          fechaRegistro,
          'ingresados',
          'MES'
        );
      }

      const fechaFin =
        dgFechaFinTicket_(ticket);

      if (
        dgEsAtendido_(ticket) &&
        dgFechaDentroPeriodo_(
          fechaFin,
          filtros
        )
      ) {
        dgAgregarTendencia_(
          diario,
          fechaFin,
          'atendidos',
          'DIA'
        );

        dgAgregarTendencia_(
          mensual,
          fechaFin,
          'atendidos',
          'MES'
        );
      }

      const fechaActualizacion =
        dgFechaActualizacionTicket_(
          ticket
        );

      if (
        dgFechaDentroPeriodo_(
          fechaActualizacion,
          filtros
        )
      ) {
        dgAgregarTendencia_(
          diario,
          fechaActualizacion,
          'actualizados',
          'DIA'
        );

        dgAgregarTendencia_(
          mensual,
          fechaActualizacion,
          'actualizados',
          'MES'
        );
      }
    }
  );

  let tendenciaDiaria =
    Object
      .keys(diario)
      .sort()
      .map(
        clave =>
          diario[clave]
      );

  const totalDias =
    tendenciaDiaria.length;

  /*
   * Para que la respuesta siga siendo ligera,
   * se muestran como máximo los últimos 180 días.
   */
  if (
    tendenciaDiaria.length >
    180
  ) {
    tendenciaDiaria =
      tendenciaDiaria.slice(
        tendenciaDiaria.length -
        180
      );
  }

  return {
    diaria:
      tendenciaDiaria,

    mensual:
      Object
        .keys(mensual)
        .sort()
        .map(
          clave =>
            mensual[clave]
        ),

    diariaRecortada:
      totalDias > 180,

    totalDias:
      totalDias
  };
}


/* =========================================================
   AUDITORÍA Y CASOS CON MAYOR TIEMPO
========================================================= */

function dgConstruirAuditoria_(
  tickets
) {
  return tickets
    .map(
      ticket => {
        const fecha =
          dgFechaActualizacionTicket_(
            ticket
          );

        return {
          numero:
            ticket.numero,

          ticket:
            ticket.ticket,

          alumno:
            ticket.alumno,

          campus:
            ticket.campus ||
            'Sin campus',

          asesor:
            ticket.responsable ||
            'Sin responsable',

          tipoTicket:
            ticket.tipoTicket ||
            'Sin tipo',

          cambios:
            Number(
              ticket.numeroCambios ||
              0
            ) || 0,

          fechaActualizacion:
            dgEtiquetaFechaHora_(
              fecha
            ),

          fechaOrden:
            fecha
              ? fecha.getTime()
              : 0,

          usuario:
            ticket
              .usuarioUltimaModificacion ||
            'Sin usuario'
        };
      }
    )
    .sort(
      (
        a,
        b
      ) =>
        b.cambios -
          a.cambios ||
        b.fechaOrden -
          a.fechaOrden
    )
    .slice(
      0,
      60
    )
    .map(
      item => {
        delete item.fechaOrden;
        return item;
      }
    );
}


function dgCasosMayorTiempo_(
  tickets
) {
  return tickets
    .filter(
      dgEsAtendido_
    )
    .map(
      ticket => {
        const duracion =
          dgDuracionTicketMs_(
            ticket
          );

        return {
          numero:
            ticket.numero,

          ticket:
            ticket.ticket,

          alumno:
            ticket.alumno,

          campus:
            ticket.campus ||
            'Sin campus',

          asesor:
            ticket.responsable ||
            'Sin responsable',

          origen:
            ticket.origen ||
            'Sin origen',

          tipoTicket:
            ticket.tipoTicket ||
            'Sin tipo',

          duracionMs:
            duracion,

          tiempoTotal:
            dgFormatearDuracion_(
              duracion
            )
        };
      }
    )
    .filter(
      item =>
        item.duracionMs > 0
    )
    .sort(
      (
        a,
        b
      ) =>
        b.duracionMs -
        a.duracionMs
    )
    .slice(
      0,
      30
    );
}


/* =========================================================
   RESUMEN GENERAL
========================================================= */

function dgConstruirResumen_(
  tickets
) {
  const acumulador =
    dgCrearAcumulador_(
      'Global'
    );

  let ultimaActualizacion =
    null;

  tickets.forEach(
    ticket => {
      dgAgregarAlAcumulador_(
        acumulador,
        ticket
      );

      const fecha =
        dgFechaActualizacionTicket_(
          ticket
        );

      if (
        fecha &&
        (
          !ultimaActualizacion ||
          fecha >
            ultimaActualizacion
        )
      ) {
        ultimaActualizacion =
          fecha;
      }
    }
  );

  const resultado =
    dgFinalizarAcumulador_(
      acumulador
    );

  return {
    total:
      resultado.tickets,

    atendidos:
      resultado.atendidos,

    activos:
      resultado.activos,

    derivados:
      resultado.derivados,

    reevaluados:
      resultado.reevaluados,

    porcentajeAtendidos:
      resultado
        .porcentajeAtendidos,

    totalCambios:
      resultado.totalCambios,

    promedioCambios:
      resultado.promedioCambios,

    casosConTiempo:
      resultado.casosConTiempo,

    tiempoPromedioGlobalMs:
      resultado.tiempoPromedioMs,

    tiempoPromedioGlobal:
      resultado.tiempoPromedio,

    ultimaActualizacion:
      dgEtiquetaFechaHora_(
        ultimaActualizacion
      )
  };
}


/* =========================================================
   CACHÉ
========================================================= */

function dgClaveCache_(filtros) {
  const contenido =
    JSON.stringify({
      fechaDesde:
        filtros.fechaDesde
          ? dgClaveFecha_(
              filtros.fechaDesde
            )
          : '',

      fechaHasta:
        filtros.fechaHasta
          ? dgClaveFecha_(
              filtros.fechaHasta
            )
          : '',

      campus:
        dgNormalizar_(
          filtros.campus
        ),

      asesor:
        dgNormalizar_(
          filtros.asesor
        ),

      origen:
        dgNormalizar_(
          filtros.origen
        ),

      tipoTicket:
        dgNormalizar_(
          filtros.tipoTicket
        ),

      tipoReevaluacion:
        dgNormalizar_(
          filtros.tipoReevaluacion
        ),

      tipoConvalidacion:
        dgNormalizar_(
          filtros.tipoConvalidacion
        ),

      tipoIngreso:
        dgNormalizar_(
          filtros.tipoIngreso
        )
    });

  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      contenido,
      Utilities.Charset.UTF_8
    );

  const hash =
    Utilities
      .base64EncodeWebSafe(
        digest
      )
      .replace(/=+$/g, '');

  return (
    'DASHBOARD_GERENCIAL_' +
    hash
  );
}


function dgLeerCache_(clave) {
  try {
    const contenido =
      CacheService
        .getScriptCache()
        .get(clave);

    return contenido
      ? JSON.parse(contenido)
      : null;

  } catch (error) {
    return null;
  }
}


function dgGuardarCache_(
  clave,
  resultado
) {
  try {
    CacheService
      .getScriptCache()
      .put(
        clave,
        JSON.stringify(
          resultado
        ),
        DG_CACHE_SEGUNDOS
      );

  } catch (error) {
    /*
     * El dashboard sigue funcionando
     * aunque el caché no esté disponible.
     */
  }
}


/* =========================================================
   SERVICIO PRINCIPAL
========================================================= */

function obtenerDashboardGerencial(
  token,
  filtros
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const filtrosPreparados =
      dgPrepararFiltros_(
        filtros
      );

    const claveCache =
      dgClaveCache_(
        filtrosPreparados
      );

    if (
      !filtrosPreparados.forzar
    ) {
      const cache =
        dgLeerCache_(
          claveCache
        );

      if (cache) {
        cache.desdeCache =
          true;

        return cache;
      }
    }

    /*
     * BASE_TICKETS se lee una sola vez.
     */
    const todos =
      leerTicketsBase()
        .tickets || [];

    /*
     * Los catálogos se construyen
     * antes de aplicar los filtros.
     */
    const catalogos =
      dgCatalogos_(todos);

    const tickets =
      todos.filter(
        ticket =>
          dgCoincideFiltro_(
            ticket,
            filtrosPreparados
          )
      );

    const tendencias =
      dgConstruirTendencias_(
        tickets,
        filtrosPreparados
      );

    const reevaluados =
      tickets.filter(
        dgEsReevaluado_
      );

    const resultado = {
      ok:
        true,

      desdeCache:
        false,

      generadoEn:
        dgEtiquetaFechaHora_(
          new Date()
        ),

      cantidadFiltrada:
        tickets.length,

      catalogos:
        catalogos,

      resumen:
        dgConstruirResumen_(
          tickets
        ),

      porCampus:
        dgAgrupar_(
          tickets,
          ticket =>
            ticket.campus,
          'Sin campus'
        ),

      porAsesor:
        dgAgrupar_(
          tickets,
          ticket =>
            ticket.responsable,
          'Sin responsable'
        ),

      porOrigen:
        dgAgrupar_(
          tickets,
          ticket =>
            ticket.origen,
          'Sin origen'
        ),

      porTipoTicket:
        dgAgrupar_(
          tickets,
          ticket =>
            ticket.tipoTicket,
          'Sin tipo de ticket'
        ),

      porTipoReevaluacion:
        dgAgrupar_(
          reevaluados,
          ticket =>
            ticket.tipoReevaluacion,
          'Sin tipo de reevaluación'
        ),

      porTipoConvalidacion:
        dgAgrupar_(
          tickets,
          ticket =>
            ticket.tipoConvalidacion,
          'Sin tipo de convalidación'
        ),

      porTipoIngreso:
        dgAgrupar_(
          tickets,
          ticket =>
            ticket.tipoIngreso,
          'Sin tipo de ingreso'
        ),

      tendenciaDiaria:
        tendencias.diaria,

      tendenciaMensual:
        tendencias.mensual,

      tendenciaDiariaRecortada:
        tendencias
          .diariaRecortada,

      totalDiasTendencia:
        tendencias.totalDias,

      auditoria:
        dgConstruirAuditoria_(
          tickets
        ),

      casosMayorTiempo:
        dgCasosMayorTiempo_(
          tickets
        )
    };

    dgGuardarCache_(
      claveCache,
      resultado
    );

    return resultado;

  } catch (error) {
    return {
      ok:
        false,

      message:
        error.message ||
        'No se pudo generar el dashboard gerencial'
    };
  }
}