const SPREADSHEET_ID =
  '1Y7X9h67QJC9cbzS59uKgr-DRGLzNVi9iczup8yrPSds';

const SHEET_USUARIOS = 'USUARIOS';
const SHEET_BASE_TICKETS = 'BASE_TICKETS';
const SHEET_LISTAS = 'LISTAS';
const SHEET_SEGUIMIENTO = 'SEGUIMIENTO';
const SHEET_ALERTAS_DATOS = 'ALERTAS_DATOS';
const SHEET_ALERTAS_PORTAL = 'ALERTAS_PORTAL';
const SHEET_CALENDARIO_LABORAL = 'CALENDARIO_LABORAL';

const VERSION = '7.2.0-bandeja-calendario-1830';
const SESSION_SECONDS = 21600;
const HORA_CORTE_MINUTOS = 18 * 60 + 30;

const TIPOS_REEVALUACION = [
  'Inconformidad Tabla',
  'Inconformidad Evaluación',
  'Cambio de Modalidad',
  'Cambio de Carrera'
];


/* =========================================================
   APLICACIÓN
========================================================= */

function doGet(e) {
  const vistaSolicitada =
    e &&
    e.parameter &&
    String(e.parameter.vista || '')
      .trim()
      .toLowerCase();

  const esDashboardGerencial =
    vistaSolicitada === 'gerencial';

  const archivoHtml =
    esDashboardGerencial
      ? 'IndexGerencial'
      : 'Index';

  const tituloPagina =
    esDashboardGerencial
      ? 'Dashboard Gerencial UTP'
      : 'Gestión de Tickets UTP';

  return HtmlService
    .createTemplateFromFile(archivoHtml)
    .evaluate()
    .setTitle(tituloPagina)
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
}


function incluir(nombreArchivo) {
  return HtmlService
    .createHtmlOutputFromFile(nombreArchivo)
    .getContent();
}


/* =========================================================
   UTILIDADES
========================================================= */

function normalizar(valor) {
  return String(
    valor == null ? '' : valor
  )
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}


function limpiar(valor) {
  return String(
    valor == null ? '' : valor
  ).trim();
}


function obtenerArchivo() {
  return SpreadsheetApp.openById(
    SPREADSHEET_ID
  );
}


function obtenerHoja(nombre) {
  const hoja =
    obtenerArchivo()
      .getSheetByName(nombre);

  if (!hoja) {
    throw new Error(
      `No se encontró la hoja ${nombre}`
    );
  }

  return hoja;
}


function obtenerOCrearHoja_(
  nombre,
  encabezados
) {
  const archivo =
    obtenerArchivo();

  let hoja =
    archivo.getSheetByName(nombre);

  if (!hoja) {
    hoja =
      archivo.insertSheet(nombre);
  }

  if (
    hoja.getLastRow() === 0 &&
    encabezados &&
    encabezados.length
  ) {
    if (
      hoja.getMaxColumns() <
      encabezados.length
    ) {
      hoja.insertColumnsAfter(
        hoja.getMaxColumns(),
        encabezados.length -
          hoja.getMaxColumns()
      );
    }

    hoja
      .getRange(
        1,
        1,
        1,
        encabezados.length
      )
      .setValues([
        encabezados
      ]);

    return hoja;
  }

  (encabezados || [])
    .forEach(
      encabezado => {
        asegurarEncabezado_(
          hoja,
          encabezado
        );
      }
    );

  return hoja;
}


function obtenerMapaEncabezados(hoja) {
  const ultimaColumna =
    Math.max(
      hoja.getLastColumn(),
      1
    );

  const encabezados =
    hoja
      .getRange(
        1,
        1,
        1,
        ultimaColumna
      )
      .getDisplayValues()[0];

  const mapa = {};

  encabezados.forEach(
    (
      encabezado,
      indice
    ) => {
      const clave =
        normalizar(encabezado);

      if (
        clave &&
        !mapa[clave]
      ) {
        mapa[clave] =
          indice + 1;
      }
    }
  );

  return mapa;
}


function validarEncabezados(
  mapa,
  requeridos,
  hojaNombre
) {
  const faltantes =
    requeridos.filter(
      encabezado =>
        !mapa[
          normalizar(encabezado)
        ]
    );

  if (faltantes.length) {
    throw new Error(
      `Faltan encabezados en ${hojaNombre}: ${faltantes.join(', ')}`
    );
  }
}


function asegurarEncabezado_(
  hoja,
  encabezado
) {
  const mapa =
    obtenerMapaEncabezados(hoja);

  const clave =
    normalizar(encabezado);

  if (mapa[clave]) {
    return mapa[clave];
  }

  const columna =
    hoja.getLastColumn() + 1;

  hoja
    .getRange(
      1,
      columna
    )
    .setValue(encabezado);

  return columna;
}


function obtenerValorFila(
  fila,
  mapa,
  encabezado
) {
  const columna =
    mapa[
      normalizar(encabezado)
    ];

  return columna
    ? limpiar(
        fila[columna - 1]
      )
    : '';
}


function obtenerValorCrudoFila_(
  fila,
  mapa,
  encabezado
) {
  const columna =
    mapa[
      normalizar(encabezado)
    ];

  return columna
    ? fila[columna - 1]
    : '';
}


function escribirPorEncabezado_(
  hoja,
  mapa,
  fila,
  encabezado,
  valor
) {
  const columna =
    mapa[
      normalizar(encabezado)
    ];

  if (!columna) {
    throw new Error(
      `No se encontró la columna ${encabezado}`
    );
  }

  hoja
    .getRange(
      fila,
      columna
    )
    .setValue(valor);
}


function parsearFechaFlexible(valor) {
  if (
    valor instanceof Date &&
    !isNaN(valor.getTime())
  ) {
    return new Date(
      valor.getTime()
    );
  }

  const texto =
    limpiar(valor);

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

    return isNaN(fecha.getTime())
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

    return isNaN(fecha.getTime())
      ? null
      : fecha;
  }

  const fecha =
    new Date(texto);

  return isNaN(fecha.getTime())
    ? null
    : fecha;
}


function claveFecha(valor) {
  const fecha =
    parsearFechaFlexible(valor);

  if (!fecha) {
    return '';
  }

  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}


function etiquetaFecha(valor) {
  const fecha =
    parsearFechaFlexible(valor);

  if (!fecha) {
    return '';
  }

  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy'
  );
}


function formatearFechaHora(valor) {
  const fecha =
    parsearFechaFlexible(valor);

  if (!fecha) {
    return limpiar(valor);
  }

  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm'
  );
}


function fechaEnPeriodo(
  valor,
  mes,
  anio
) {
  const fecha =
    parsearFechaFlexible(valor);

  if (!fecha) {
    return false;
  }

  const mesNumero =
    Number(mes || 0);

  const anioNumero =
    Number(anio || 0);

  if (
    mesNumero &&
    fecha.getMonth() + 1 !==
      mesNumero
  ) {
    return false;
  }

  if (
    anioNumero &&
    fecha.getFullYear() !==
      anioNumero
  ) {
    return false;
  }

  return true;
}


function formatearDuracion(
  milisegundos
) {
  if (
    !Number.isFinite(
      milisegundos
    ) ||
    milisegundos < 0
  ) {
    return '';
  }

  const minutosTotales =
    Math.floor(
      milisegundos / 60000
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

  if (dias) {
    partes.push(
      `${dias} día${dias === 1 ? '' : 's'}`
    );
  }

  if (horas) {
    partes.push(
      `${horas} hora${horas === 1 ? '' : 's'}`
    );
  }

  if (
    minutos ||
    !partes.length
  ) {
    partes.push(
      `${minutos} minuto${minutos === 1 ? '' : 's'}`
    );
  }

  return partes.join(' ');
}


function generarClaveTemporal(
  nombreCompleto
) {
  const partes =
    limpiar(nombreCompleto)
      .split(/\s+/)
      .filter(Boolean);

  const primera =
    normalizar(
      partes[0] || 'U'
    ).charAt(0) || 'U';

  const segunda =
    normalizar(
      partes[1] ||
      partes[0] ||
      'T'
    ).charAt(0) || 'T';

  return `${primera}${segunda}1234`;
}


/* =========================================================
   ESTRUCTURA
========================================================= */

function asegurarEstructuraBaseTickets_() {
  const hoja =
    obtenerHoja(
      SHEET_BASE_TICKETS
    );

  if (
    hoja.getMaxColumns() < 27
  ) {
    hoja.insertColumnsAfter(
      hoja.getMaxColumns(),
      27 -
        hoja.getMaxColumns()
    );
  }

  const encabezadoAA =
    limpiar(
      hoja
        .getRange(1, 27)
        .getDisplayValue()
    );

  const encabezadoNormalizado =
    normalizar(encabezadoAA);

  if (
    !encabezadoAA ||
    encabezadoNormalizado ===
      'TIPO REEVALUACION' ||
    encabezadoNormalizado ===
      'TIPO DE REEVALUACION'
  ) {
    hoja
      .getRange(1, 27)
      .setValue(
        'TIPO DE REEVALUACIÓN'
      );
  } else if (
    encabezadoNormalizado !==
    normalizar(
      'TIPO DE REEVALUACIÓN'
    )
  ) {
    asegurarEncabezado_(
      hoja,
      'TIPO DE REEVALUACIÓN'
    );
  }

  [
    'REPORTADO PORTAL',
    'RESPONSABLE ANTERIOR',
    'FECHA REPORTE PORTAL',
    'USUARIO REPORTE PORTAL'
  ].forEach(
    encabezado => {
      asegurarEncabezado_(
        hoja,
        encabezado
      );
    }
  );

  return hoja;
}


function asegurarEstructuraUsuariosAsignacion_() {
  const hoja =
    obtenerHoja(
      SHEET_USUARIOS
    );

  asegurarEncabezado_(
    hoja,
    'HABILITADO ASIGNACIÓN'
  );

  asegurarEncabezado_(
    hoja,
    'ÚLTIMA ASIGNACIÓN'
  );

  return hoja;
}


function obtenerOCrearHojaSeguimiento_() {
  return obtenerOCrearHoja_(
    SHEET_SEGUIMIENTO,
    [
      'FECHA',
      'N°',
      'ID TICKET',
      'ORIGEN',
      'ASESOR',
      'USUARIO',
      'TIPO',
      'OBSERVACIÓN'
    ]
  );
}


function obtenerOCrearHojaAlertasDatos() {
  return obtenerOCrearHoja_(
    SHEET_ALERTAS_DATOS,
    [
      'ID',
      'N°',
      'ID TICKET',
      'DNI',
      'ALUMNO',
      'RESPONSABLE',
      'CAMPOS FALTANTES',
      'FECHA NOTIFICACIÓN',
      'USUARIO NOTIFICADOR',
      'ESTADO',
      'FECHA RESOLUCIÓN'
    ]
  );
}


function obtenerOCrearHojaAlertasPortal_() {
  return obtenerOCrearHoja_(
    SHEET_ALERTAS_PORTAL,
    [
      'ID',
      'N°',
      'ID TICKET',
      'DNI',
      'ALUMNO',
      'RESPONSABLE ANTERIOR',
      'FECHA/HORA',
      'USUARIO QUE REPORTÓ',
      'MENSAJE',
      'ESTADO',
      'NUEVO RESPONSABLE',
      'FECHA RESOLUCIÓN',
      'USUARIO RESOLUCIÓN'
    ]
  );
}


function obtenerOCrearHojaCalendarioLaboral_() {
  return obtenerOCrearHoja_(
    SHEET_CALENDARIO_LABORAL,
    [
      'FECHA',
      'LABORABLE',
      'DESCRIPCIÓN',
      'USUARIO',
      'FECHA ACTUALIZACIÓN'
    ]
  );
}


function prepararEstructuraPortalYCalendario() {
  asegurarEstructuraBaseTickets_();
  asegurarEstructuraUsuariosAsignacion_();
  obtenerOCrearHojaSeguimiento_();
  obtenerOCrearHojaAlertasDatos();
  obtenerOCrearHojaAlertasPortal_();
  obtenerOCrearHojaCalendarioLaboral_();

  const finesSemana =
    cargarFinesDeSemanaCalendario_();

  return {
    ok: true,
    finesSemana,
    message:
      'Estructura preparada y fines de semana cargados'
  };
}


/* =========================================================
   SESIÓN
========================================================= */

function guardarSesion(sesion) {
  CacheService
    .getScriptCache()
    .put(
      `SESSION_${sesion.token}`,
      JSON.stringify(sesion),
      SESSION_SECONDS
    );
}


function validarSesion(token) {
  const tokenLimpio =
    limpiar(token);

  if (!tokenLimpio) {
    return {
      ok: false,
      message:
        'Sesión no válida'
    };
  }

  const contenido =
    CacheService
      .getScriptCache()
      .get(
        `SESSION_${tokenLimpio}`
      );

  if (!contenido) {
    return {
      ok: false,
      message:
        'La sesión terminó. Vuelve a ingresar.'
    };
  }

  return {
    ok: true,
    sesion:
      JSON.parse(contenido)
  };
}


function validarAdmin(token) {
  const validacion =
    validarSesion(token);

  if (!validacion.ok) {
    return validacion;
  }

  if (
    validacion.sesion.rol !==
    'ADMIN'
  ) {
    return {
      ok: false,
      message:
        'Acceso exclusivo para administrador'
    };
  }

  return validacion;
}


function cerrarSesion(token) {
  const tokenLimpio =
    limpiar(token);

  if (tokenLimpio) {
    CacheService
      .getScriptCache()
      .remove(
        `SESSION_${tokenLimpio}`
      );
  }

  return {
    ok: true
  };
}


/* =========================================================
   USUARIOS
========================================================= */

function obtenerUsuariosActivos() {
  const hoja =
    obtenerHoja(
      SHEET_USUARIOS
    );

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  validarEncabezados(
    mapa,
    [
      'USUARIO',
      'CLAVE',
      'NOMBRE',
      'ROL',
      'ACTIVO',
      'ÚLTIMO INGRESO',
      'RESPONSABLE ASIGNADO',
      'CAMBIAR CLAVE'
    ],
    SHEET_USUARIOS
  );

  if (
    hoja.getLastRow() < 2
  ) {
    return [];
  }

  return hoja
    .getRange(
      2,
      1,
      hoja.getLastRow() - 1,
      hoja.getLastColumn()
    )
    .getDisplayValues()
    .map(
      fila => ({
        usuario:
          obtenerValorFila(
            fila,
            mapa,
            'USUARIO'
          ),

        nombre:
          obtenerValorFila(
            fila,
            mapa,
            'NOMBRE'
          ),

        rol:
          normalizar(
            obtenerValorFila(
              fila,
              mapa,
              'ROL'
            )
          ),

        activo:
          normalizar(
            obtenerValorFila(
              fila,
              mapa,
              'ACTIVO'
            )
          )
      })
    )
    .filter(
      usuario =>
        usuario.usuario &&
        usuario.nombre &&
        usuario.activo === 'SI'
    )
    .map(
      usuario => ({
        usuario:
          usuario.usuario,

        nombre:
          usuario.nombre,

        rol:
          usuario.rol
      })
    );
}


function iniciarSesion(datos) {
  try {
    const usuarioSeleccionado =
      limpiar(
        datos &&
        datos.usuario
      );

    const claveIngresada =
      limpiar(
        datos &&
        datos.clave
      );

    if (!usuarioSeleccionado) {
      throw new Error(
        'Selecciona un usuario'
      );
    }

    const hoja =
      obtenerHoja(
        SHEET_USUARIOS
      );

    const mapa =
      obtenerMapaEncabezados(
        hoja
      );

    const valores =
      hoja.getLastRow() < 2
        ? []
        : hoja
            .getRange(
              2,
              1,
              hoja.getLastRow() - 1,
              hoja.getLastColumn()
            )
            .getDisplayValues();

    let encontrado = null;

    valores.some(
      (
        fila,
        indice
      ) => {
        const usuario =
          obtenerValorFila(
            fila,
            mapa,
            'USUARIO'
          );

        if (
          normalizar(usuario) !==
          normalizar(
            usuarioSeleccionado
          )
        ) {
          return false;
        }

        encontrado = {
          fila:
            indice + 2,

          usuario,

          clave:
            obtenerValorFila(
              fila,
              mapa,
              'CLAVE'
            ),

          nombre:
            obtenerValorFila(
              fila,
              mapa,
              'NOMBRE'
            ),

          rol:
            normalizar(
              obtenerValorFila(
                fila,
                mapa,
                'ROL'
              )
            ),

          activo:
            normalizar(
              obtenerValorFila(
                fila,
                mapa,
                'ACTIVO'
              )
            ),

          responsableAsignado:
            obtenerValorFila(
              fila,
              mapa,
              'RESPONSABLE ASIGNADO'
            ),

          cambiarClave:
            normalizar(
              obtenerValorFila(
                fila,
                mapa,
                'CAMBIAR CLAVE'
              )
            )
        };

        return true;
      }
    );

    if (!encontrado) {
      throw new Error(
        'Usuario no encontrado'
      );
    }

    if (
      encontrado.activo !==
      'SI'
    ) {
      throw new Error(
        'Usuario desactivado'
      );
    }

    if (
      encontrado.clave &&
      encontrado.clave !==
        claveIngresada
    ) {
      throw new Error(
        'Clave incorrecta'
      );
    }

    if (
      encontrado.rol !==
        'ADMIN' &&
      !encontrado
        .responsableAsignado
    ) {
      throw new Error(
        'Este usuario no tiene responsable asignado'
      );
    }

    const ahora =
      new Date();

    hoja
      .getRange(
        encontrado.fila,
        mapa[
          normalizar(
            'ÚLTIMO INGRESO'
          )
        ]
      )
      .setValue(ahora);

    const sesion = {
      token:
        Utilities.getUuid(),

      usuario:
        encontrado.usuario,

      nombre:
        encontrado.nombre,

      rol:
        encontrado.rol,

      responsableAsignado:
        encontrado
          .responsableAsignado,

      debeCambiarClave:
        encontrado
          .cambiarClave === 'SI',

      ingreso:
        ahora.toISOString()
    };

    guardarSesion(sesion);

    return {
      ok: true,
      version: VERSION,
      token:
        sesion.token,
      usuario:
        sesion.usuario,
      nombre:
        sesion.nombre,
      rol:
        sesion.rol,
      responsableAsignado:
        sesion
          .responsableAsignado,
      debeCambiarClave:
        sesion
          .debeCambiarClave
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message,
      version: VERSION
    };
  }
}


function cambiarMiClave(
  token,
  datos
) {
  try {
    const validacion =
      validarSesion(token);

    if (!validacion.ok) {
      return validacion;
    }

    const claveActual =
      limpiar(
        datos &&
        datos.claveActual
      );

    const nuevaClave =
      limpiar(
        datos &&
        datos.nuevaClave
      );

    const confirmarClave =
      limpiar(
        datos &&
        datos.confirmarClave
      );

    if (
      nuevaClave.length < 6
    ) {
      throw new Error(
        'La nueva clave debe tener al menos 6 caracteres'
      );
    }

    if (
      nuevaClave !==
      confirmarClave
    ) {
      throw new Error(
        'Las nuevas claves no coinciden'
      );
    }

    const hoja =
      obtenerHoja(
        SHEET_USUARIOS
      );

    const mapa =
      obtenerMapaEncabezados(
        hoja
      );

    const valores =
      hoja.getLastRow() < 2
        ? []
        : hoja
            .getRange(
              2,
              1,
              hoja.getLastRow() - 1,
              hoja.getLastColumn()
            )
            .getDisplayValues();

    let filaObjetivo = 0;
    let claveGuardada = '';

    valores.some(
      (
        fila,
        indice
      ) => {
        if (
          normalizar(
            obtenerValorFila(
              fila,
              mapa,
              'USUARIO'
            )
          ) ===
          normalizar(
            validacion
              .sesion.usuario
          )
        ) {
          filaObjetivo =
            indice + 2;

          claveGuardada =
            obtenerValorFila(
              fila,
              mapa,
              'CLAVE'
            );

          return true;
        }

        return false;
      }
    );

    if (!filaObjetivo) {
      throw new Error(
        'Usuario no encontrado'
      );
    }

    if (
      claveGuardada &&
      claveGuardada !==
        claveActual
    ) {
      throw new Error(
        'La clave actual no es correcta'
      );
    }

    escribirPorEncabezado_(
      hoja,
      mapa,
      filaObjetivo,
      'CLAVE',
      nuevaClave
    );

    escribirPorEncabezado_(
      hoja,
      mapa,
      filaObjetivo,
      'CAMBIAR CLAVE',
      'NO'
    );

    validacion
      .sesion
      .debeCambiarClave =
      false;

    guardarSesion(
      validacion.sesion
    );

    return {
      ok: true,
      message:
        'Clave actualizada correctamente'
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


function obtenerResponsablesDesdeListas() {
  const hoja =
    obtenerHoja(
      SHEET_LISTAS
    );

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  const columna =
    mapa[
      normalizar(
        'RESPONSABLE'
      )
    ];

  if (
    !columna ||
    hoja.getLastRow() < 2
  ) {
    return [];
  }

  return [
    ...new Set(
      hoja
        .getRange(
          2,
          columna,
          hoja.getLastRow() - 1,
          1
        )
        .getDisplayValues()
        .flat()
        .map(limpiar)
        .filter(Boolean)
    )
  ];
}


function obtenerPanelUsuarios(token) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const hoja =
      obtenerHoja(
        SHEET_USUARIOS
      );

    const mapa =
      obtenerMapaEncabezados(
        hoja
      );

    const usuarios =
      hoja.getLastRow() < 2
        ? []
        : hoja
            .getRange(
              2,
              1,
              hoja.getLastRow() - 1,
              hoja.getLastColumn()
            )
            .getDisplayValues()
            .map(
              fila => ({
                usuario:
                  obtenerValorFila(
                    fila,
                    mapa,
                    'USUARIO'
                  ),

                nombre:
                  obtenerValorFila(
                    fila,
                    mapa,
                    'NOMBRE'
                  ),

                rol:
                  normalizar(
                    obtenerValorFila(
                      fila,
                      mapa,
                      'ROL'
                    )
                  ),

                activo:
                  normalizar(
                    obtenerValorFila(
                      fila,
                      mapa,
                      'ACTIVO'
                    )
                  ),

                ultimoIngreso:
                  obtenerValorFila(
                    fila,
                    mapa,
                    'ÚLTIMO INGRESO'
                  ),

                responsableAsignado:
                  obtenerValorFila(
                    fila,
                    mapa,
                    'RESPONSABLE ASIGNADO'
                  ),

                cambiarClave:
                  normalizar(
                    obtenerValorFila(
                      fila,
                      mapa,
                      'CAMBIAR CLAVE'
                    )
                  )
              })
            );

    return {
      ok: true,
      usuarios,
      responsables:
        obtenerResponsablesDesdeListas()
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


function guardarUsuarioAdmin(
  token,
  datos
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const usuarioObjetivo =
      limpiar(
        datos &&
        datos.usuario
      );

    const responsable =
      limpiar(
        datos &&
        datos.responsableAsignado
      );

    const activo =
      normalizar(
        datos &&
        datos.activo
      ) === 'NO'
        ? 'NO'
        : 'SI';

    const hoja =
      obtenerHoja(
        SHEET_USUARIOS
      );

    const mapa =
      obtenerMapaEncabezados(
        hoja
      );

    const valores =
      hoja.getLastRow() < 2
        ? []
        : hoja
            .getRange(
              2,
              1,
              hoja.getLastRow() - 1,
              hoja.getLastColumn()
            )
            .getDisplayValues();

    let filaObjetivo = 0;
    let responsableAnterior = '';
    let claveActual = '';

    valores.some(
      (
        fila,
        indice
      ) => {
        if (
          normalizar(
            obtenerValorFila(
              fila,
              mapa,
              'USUARIO'
            )
          ) ===
          normalizar(
            usuarioObjetivo
          )
        ) {
          filaObjetivo =
            indice + 2;

          responsableAnterior =
            obtenerValorFila(
              fila,
              mapa,
              'RESPONSABLE ASIGNADO'
            );

          claveActual =
            obtenerValorFila(
              fila,
              mapa,
              'CLAVE'
            );

          return true;
        }

        return false;
      }
    );

    if (!filaObjetivo) {
      throw new Error(
        'Usuario no encontrado'
      );
    }

    escribirPorEncabezado_(
      hoja,
      mapa,
      filaObjetivo,
      'RESPONSABLE ASIGNADO',
      responsable
    );

    escribirPorEncabezado_(
      hoja,
      mapa,
      filaObjetivo,
      'ACTIVO',
      activo
    );

    let claveTemporal = '';

    if (
      responsable &&
      (
        normalizar(
          responsable
        ) !==
          normalizar(
            responsableAnterior
          ) ||
        !claveActual
      )
    ) {
      claveTemporal =
        generarClaveTemporal(
          responsable
        );

      escribirPorEncabezado_(
        hoja,
        mapa,
        filaObjetivo,
        'CLAVE',
        claveTemporal
      );

      escribirPorEncabezado_(
        hoja,
        mapa,
        filaObjetivo,
        'CAMBIAR CLAVE',
        'SI'
      );
    }

    return {
      ok: true,
      message:
        'Usuario actualizado',
      claveTemporal
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
   LISTAS
========================================================= */

function obtenerListas(token) {
  try {
    const validacion =
      validarSesion(token);

    if (!validacion.ok) {
      return validacion;
    }

    const hoja =
      obtenerHoja(
        SHEET_LISTAS
      );

    const mapa =
      obtenerMapaEncabezados(
        hoja
      );

    const salida = {
      campus: [],
      tipoIngreso: [],
      tipoConvalidacion: [],
      tipoReevaluacion:
        TIPOS_REEVALUACION.slice(),
      detalle: [],
      responsables: []
    };

    if (
      hoja.getLastRow() < 2
    ) {
      return {
        ok: true,
        listas: salida
      };
    }

    const valores =
      hoja
        .getRange(
          2,
          1,
          hoja.getLastRow() - 1,
          hoja.getLastColumn()
        )
        .getDisplayValues();

    const agregar = (
      lista,
      valor
    ) => {
      const dato =
        limpiar(valor);

      if (
        dato &&
        !lista.includes(dato)
      ) {
        lista.push(dato);
      }
    };

    valores.forEach(
      fila => {
        agregar(
          salida.campus,
          obtenerValorFila(
            fila,
            mapa,
            'CAMPUS'
          )
        );

        agregar(
          salida.tipoIngreso,
          obtenerValorFila(
            fila,
            mapa,
            'TIPO DE INGRESO'
          )
        );

        agregar(
          salida.tipoConvalidacion,
          obtenerValorFila(
            fila,
            mapa,
            'TIPO DE CONVALIDACIÓN'
          )
        );

        agregar(
          salida.detalle,
          obtenerValorFila(
            fila,
            mapa,
            'DETALLE'
          )
        );

        agregar(
          salida.responsables,
          obtenerValorFila(
            fila,
            mapa,
            'RESPONSABLE'
          )
        );
      }
    );

    return {
      ok: true,
      listas: salida
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
   CALENDARIO LABORAL
========================================================= */

function leerCalendarioLaboralInterno_() {
  const hoja =
    obtenerOCrearHojaCalendarioLaboral_();

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  if (
    hoja.getLastRow() < 2
  ) {
    return [];
  }

  const rango =
    hoja.getRange(
      2,
      1,
      hoja.getLastRow() - 1,
      hoja.getLastColumn()
    );

  const display =
    rango.getDisplayValues();

  const valores =
    rango.getValues();

  return display
    .map(
      (
        fila,
        indice
      ) => {
        const fecha =
          parsearFechaFlexible(
            obtenerValorCrudoFila_(
              valores[indice],
              mapa,
              'FECHA'
            ) ||
            obtenerValorFila(
              fila,
              mapa,
              'FECHA'
            )
          );

        if (!fecha) {
          return null;
        }

        return {
          rowNumber:
            indice + 2,

          fecha:
            Utilities.formatDate(
              fecha,
              Session.getScriptTimeZone(),
              'yyyy-MM-dd'
            ),

          laborable:
            normalizar(
              obtenerValorFila(
                fila,
                mapa,
                'LABORABLE'
              )
            ) === 'SI',

          descripcion:
            obtenerValorFila(
              fila,
              mapa,
              'DESCRIPCIÓN'
            ),

          usuario:
            obtenerValorFila(
              fila,
              mapa,
              'USUARIO'
            ),

          fechaActualizacion:
            obtenerValorFila(
              fila,
              mapa,
              'FECHA ACTUALIZACIÓN'
            )
        };
      }
    )
    .filter(Boolean)
    .sort(
      (
        a,
        b
      ) =>
        a.fecha.localeCompare(
          b.fecha
        )
    );
}


function cargarFinesDeSemanaCalendario_() {
  const hoja =
    obtenerOCrearHojaCalendarioLaboral_();

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  const existentes =
    new Set(
      leerCalendarioLaboralInterno_()
        .map(
          registro =>
            registro.fecha
        )
    );

  const anioActual =
    new Date().getFullYear();

  const nuevasFilas = [];

  for (
    let anio = anioActual;
    anio <= anioActual + 1;
    anio++
  ) {
    const fecha =
      new Date(
        anio,
        0,
        1
      );

    while (
      fecha.getFullYear() ===
      anio
    ) {
      const dia =
        fecha.getDay();

      const clave =
        Utilities.formatDate(
          fecha,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );

      if (
        (
          dia === 0 ||
          dia === 6
        ) &&
        !existentes.has(clave)
      ) {
        nuevasFilas.push([
          new Date(
            fecha.getFullYear(),
            fecha.getMonth(),
            fecha.getDate()
          ),
          'NO',
          '',
          'SISTEMA',
          new Date()
        ]);

        existentes.add(clave);
      }

      fecha.setDate(
        fecha.getDate() + 1
      );
    }
  }

  if (nuevasFilas.length) {
    hoja
      .getRange(
        hoja.getLastRow() + 1,
        1,
        nuevasFilas.length,
        5
      )
      .setValues(
        nuevasFilas
      );

    hoja
      .getRange(
        hoja.getLastRow() -
          nuevasFilas.length +
          1,
        mapa[
          normalizar('FECHA')
        ],
        nuevasFilas.length,
        1
      )
      .setNumberFormat(
        'dd/MM/yyyy'
      );
  }

  return nuevasFilas.length;
}


function obtenerMapaCalendarioLaboral_() {
  const mapa = {};

  leerCalendarioLaboralInterno_()
    .forEach(
      registro => {
        mapa[registro.fecha] =
          registro.laborable;
      }
    );

  return mapa;
}


function esDiaLaborable_(
  fecha,
  mapaCalendario
) {
  const clave =
    claveFecha(fecha);

  if (!clave) {
    return false;
  }

  if (
    Object.prototype
      .hasOwnProperty
      .call(
        mapaCalendario || {},
        clave
      )
  ) {
    return Boolean(
      mapaCalendario[clave]
    );
  }

  /*
   * Si la fecha no está registrada,
   * se considera habilitada.
   *
   * Los sábados y domingos se cargan
   * inicialmente como NO laborables.
   * Si se eliminan o se cambian a SI,
   * podrán usarse.
   */
  return true;
}


function siguienteDiaLaborable_(
  fecha,
  mapaCalendario
) {
  const resultado =
    new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate()
    );

  do {
    resultado.setDate(
      resultado.getDate() + 1
    );
  } while (
    !esDiaLaborable_(
      resultado,
      mapaCalendario
    )
  );

  return resultado;
}


function calcularFechaOperativa_(
  fechaHora
) {
  const fecha =
    parsearFechaFlexible(
      fechaHora
    );

  if (!fecha) {
    return null;
  }

  const mapaCalendario =
    obtenerMapaCalendarioLaboral_();

  let fechaOperativa =
    new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate()
    );

  const minutos =
    fecha.getHours() * 60 +
    fecha.getMinutes();

  /*
   * Después de las 6:30 p. m.,
   * se intenta registrar al día siguiente.
   */
  if (
    minutos >
    HORA_CORTE_MINUTOS
  ) {
    fechaOperativa.setDate(
      fechaOperativa.getDate() + 1
    );
  }

  /*
   * Si la fecha está bloqueada,
   * avanza hasta encontrar una habilitada.
   */
  while (
    !esDiaLaborable_(
      fechaOperativa,
      mapaCalendario
    )
  ) {
    fechaOperativa.setDate(
      fechaOperativa.getDate() + 1
    );
  }

  return fechaOperativa;
}


function calcularFechaInicioOperativa_(
  fechaRegistro
) {
  return calcularFechaOperativa_(
    fechaRegistro
  );
}


function calcularMilisegundosLaborales_(
  inicio,
  fin
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

  const mapaCalendario =
    obtenerMapaCalendarioLaboral_();

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

  while (
    cursor <= ultimoDia
  ) {
    if (
      esDiaLaborable_(
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

      if (
        tramoFin >
        tramoInicio
      ) {
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


function obtenerCalendarioLaboral(token) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    return {
      ok: true,
      registros:
        leerCalendarioLaboralInterno_()
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


function guardarFechaCalendarioLaboral(
  token,
  datos
) {
  const lock =
    LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const fecha =
      parsearFechaFlexible(
        datos &&
        datos.fecha
      );

    if (!fecha) {
      throw new Error(
        'Selecciona una fecha válida'
      );
    }

    const clave =
      Utilities.formatDate(
        fecha,
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      );

    const laborable =
      normalizar(
        datos &&
        datos.laborable
      ) === 'SI'
        ? 'SI'
        : 'NO';

    const descripcion =
      limpiar(
        datos &&
        datos.descripcion
      );

    const hoja =
      obtenerOCrearHojaCalendarioLaboral_();

    const mapa =
      obtenerMapaEncabezados(
        hoja
      );

    const existente =
      leerCalendarioLaboralInterno_()
        .find(
          registro =>
            registro.fecha ===
            clave
        );

    const fila =
      existente
        ? existente.rowNumber
        : hoja.getLastRow() + 1;

    escribirPorEncabezado_(
      hoja,
      mapa,
      fila,
      'FECHA',
      fecha
    );

    hoja
      .getRange(
        fila,
        mapa[
          normalizar('FECHA')
        ]
      )
      .setNumberFormat(
        'dd/MM/yyyy'
      );

    escribirPorEncabezado_(
      hoja,
      mapa,
      fila,
      'LABORABLE',
      laborable
    );

    escribirPorEncabezado_(
      hoja,
      mapa,
      fila,
      'DESCRIPCIÓN',
      descripcion
    );

    escribirPorEncabezado_(
      hoja,
      mapa,
      fila,
      'USUARIO',
      validacion
        .sesion.usuario
    );

    escribirPorEncabezado_(
      hoja,
      mapa,
      fila,
      'FECHA ACTUALIZACIÓN',
      new Date()
    );

    return {
      ok: true,
      message:
        laborable === 'SI'
          ? 'Fecha habilitada correctamente'
          : 'Fecha bloqueada correctamente'
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


function eliminarFechaCalendarioLaboral(
  token,
  fecha
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const clave =
      claveFecha(fecha);

    const hoja =
      obtenerOCrearHojaCalendarioLaboral_();

    const registro =
      leerCalendarioLaboralInterno_()
        .find(
          item =>
            item.fecha === clave
        );

    if (!registro) {
      throw new Error(
        'No se encontró la fecha'
      );
    }

    hoja.deleteRow(
      registro.rowNumber
    );

    return {
      ok: true,
      message:
        'La fecha quedó habilitada al eliminar el bloqueo'
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
   FECHA INICIO
========================================================= */

function completarFechaInicioOperativaFila_(
  hoja,
  fila,
  mapaOpcional
) {
  const mapa =
    mapaOpcional ||
    obtenerMapaEncabezados(
      hoja
    );

  const columnaRegistro =
    mapa[
      normalizar('REGISTRO')
    ];

  const columnaFechaInicio =
    mapa[
      normalizar('Fecha inicio')
    ];

  if (
    !columnaRegistro ||
    !columnaFechaInicio ||
    fila < 2
  ) {
    return false;
  }

  const celdaInicio =
    hoja.getRange(
      fila,
      columnaFechaInicio
    );

  if (
    celdaInicio.getValue() !==
    ''
  ) {
    return false;
  }

  const registro =
    hoja
      .getRange(
        fila,
        columnaRegistro
      )
      .getValue();

  const fechaOperativa =
    calcularFechaInicioOperativa_(
      registro
    );

  if (!fechaOperativa) {
    return false;
  }

  celdaInicio
    .setValue(
      fechaOperativa
    )
    .setNumberFormat(
      'dd/MM/yyyy'
    );

  return true;
}


function onEdit(e) {
  try {
    if (
      !e ||
      !e.range
    ) {
      return;
    }

    const hoja =
      e.range.getSheet();

    if (
      hoja.getName() !==
      SHEET_BASE_TICKETS
    ) {
      return;
    }

    const mapa =
      obtenerMapaEncabezados(
        hoja
      );

    for (
      let fila =
        Math.max(
          2,
          e.range.getRow()
        );
      fila <=
        e.range.getLastRow();
      fila++
    ) {
      completarFechaInicioOperativaFila_(
        hoja,
        fila,
        mapa
      );
    }

  } catch (error) {
    console.error(error);
  }
}


function completarFechaInicioFilasNuevas() {
  const hoja =
    asegurarEstructuraBaseTickets_();

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  let actualizadas = 0;

  for (
    let fila = 2;
    fila <= hoja.getLastRow();
    fila++
  ) {
    if (
      completarFechaInicioOperativaFila_(
        hoja,
        fila,
        mapa
      )
    ) {
      actualizadas++;
    }
  }

  return {
    ok: true,
    actualizadas
  };
}


function recalcularFechaInicioOperativa() {
  return completarFechaInicioFilasNuevas();
}


function instalarActivadorFechaInicio() {
  ScriptApp
    .getProjectTriggers()
    .filter(
      activador =>
        activador
          .getHandlerFunction() ===
        'completarFechaInicioFilasNuevas'
    )
    .forEach(
      activador =>
        ScriptApp.deleteTrigger(
          activador
        )
    );

  ScriptApp
    .newTrigger(
      'completarFechaInicioFilasNuevas'
    )
    .timeBased()
    .everyMinutes(5)
    .create();

  return {
    ok: true,
    message:
      'Activador instalado'
  };
}


function crearActivadorFechaInicio() {
  return instalarActivadorFechaInicio();
}


/* =========================================================
   TICKETS
========================================================= */

function leerTicketsBase() {
  const hoja =
    asegurarEstructuraBaseTickets_();

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  validarEncabezados(
    mapa,
    [
      'N°',
      'ID Ticket',
      'DNI',
      'ALUMNOS2',
      'CAMPUS',
      'ESTADO TICKET',
      'TIPO DE CONVALIDACIÓN',
      'TIPO DE INGRESO',
      'REGISTRO',
      'FECHA FIN',
      'Responsable',
      'Detalle',
      'ORIGEN',
      'Observación',
      'FECHA ACTUALIZACIÓN',
      'N° DE CAMBIOS',
      'TIEMPO INICIO',
      'TIEMPO FIN',
      'TIEMPO TOTAL',
      'USUARIO ÚLTIMA MODIFICACIÓN'
    ],
    SHEET_BASE_TICKETS
  );

  if (
    hoja.getLastRow() < 2
  ) {
    return {
      hoja,
      mapa,
      tickets: []
    };
  }

  const rango =
    hoja.getRange(
      2,
      1,
      hoja.getLastRow() - 1,
      hoja.getLastColumn()
    );

  const display =
    rango.getDisplayValues();

  const valores =
    rango.getValues();

  const tickets =
    display
      .map(
        (
          fila,
          indice
        ) => ({
          rowNumber:
            indice + 2,

          numero:
            obtenerValorFila(
              fila,
              mapa,
              'N°'
            ),

          ticket:
            obtenerValorFila(
              fila,
              mapa,
              'ID Ticket'
            ),

          tipoTicket:
            obtenerValorFila(
              fila,
              mapa,
              'TIPO DE TICKET'
            ),

          dni:
            obtenerValorFila(
              fila,
              mapa,
              'DNI'
            ),

          alumno:
            obtenerValorFila(
              fila,
              mapa,
              'ALUMNOS2'
            ),

          campus:
            obtenerValorFila(
              fila,
              mapa,
              'CAMPUS'
            ),

          estado:
            obtenerValorFila(
              fila,
              mapa,
              'ESTADO TICKET'
            ),

          tipoConvalidacion:
            obtenerValorFila(
              fila,
              mapa,
              'TIPO DE CONVALIDACIÓN'
            ),

          tipoIngreso:
            obtenerValorFila(
              fila,
              mapa,
              'TIPO DE INGRESO'
            ),

          registro:
            obtenerValorFila(
              fila,
              mapa,
              'REGISTRO'
            ),

          registroRaw:
            obtenerValorCrudoFila_(
              valores[indice],
              mapa,
              'REGISTRO'
            ),

          fechaInicio:
            obtenerValorFila(
              fila,
              mapa,
              'Fecha inicio'
            ),

          fechaInicioRaw:
            obtenerValorCrudoFila_(
              valores[indice],
              mapa,
              'Fecha inicio'
            ),

          fechaFin:
            obtenerValorFila(
              fila,
              mapa,
              'FECHA FIN'
            ),

          fechaFinRaw:
            obtenerValorCrudoFila_(
              valores[indice],
              mapa,
              'FECHA FIN'
            ),

          responsable:
            obtenerValorFila(
              fila,
              mapa,
              'Responsable'
            ),

          detalle:
            obtenerValorFila(
              fila,
              mapa,
              'Detalle'
            ),

          origen:
            obtenerValorFila(
              fila,
              mapa,
              'ORIGEN'
            ),

          observacion:
            obtenerValorFila(
              fila,
              mapa,
              'Observación'
            ),

          fechaActualizacion:
            obtenerValorFila(
              fila,
              mapa,
              'FECHA ACTUALIZACIÓN'
            ),

          numeroCambios:
            obtenerValorFila(
              fila,
              mapa,
              'N° DE CAMBIOS'
            ),

          tiempoInicio:
            obtenerValorFila(
              fila,
              mapa,
              'TIEMPO INICIO'
            ),

          tiempoInicioRaw:
            obtenerValorCrudoFila_(
              valores[indice],
              mapa,
              'TIEMPO INICIO'
            ),

          tiempoFin:
            obtenerValorFila(
              fila,
              mapa,
              'TIEMPO FIN'
            ),

          tiempoFinRaw:
            obtenerValorCrudoFila_(
              valores[indice],
              mapa,
              'TIEMPO FIN'
            ),

          tiempoTotal:
            obtenerValorFila(
              fila,
              mapa,
              'TIEMPO TOTAL'
            ),

          usuarioUltimaModificacion:
            obtenerValorFila(
              fila,
              mapa,
              'USUARIO ÚLTIMA MODIFICACIÓN'
            ),

          tipoReevaluacion:
            obtenerValorFila(
              fila,
              mapa,
              'TIPO DE REEVALUACIÓN'
            ),

          reportadoPortal:
            obtenerValorFila(
              fila,
              mapa,
              'REPORTADO PORTAL'
            ),

          responsableAnterior:
            obtenerValorFila(
              fila,
              mapa,
              'RESPONSABLE ANTERIOR'
            ),

          fechaReportePortal:
            obtenerValorFila(
              fila,
              mapa,
              'FECHA REPORTE PORTAL'
            ),

          usuarioReportePortal:
            obtenerValorFila(
              fila,
              mapa,
              'USUARIO REPORTE PORTAL'
            )
        })
      )
      .filter(
        ticket =>
          ticket.numero ||
          ticket.ticket
      );

  return {
    hoja,
    mapa,
    tickets
  };
}


/*
 * Esta función es indispensable.
 * El navegador no puede recibir objetos Date
 * directamente desde google.script.run.
 */
function serializarTicketParaCliente_(
  ticket
) {
  if (!ticket) {
    return null;
  }

  return {
    rowNumber:
      ticket.rowNumber,

    numero:
      ticket.numero,

    ticket:
      ticket.ticket,

    tipoTicket:
      ticket.tipoTicket,

    dni:
      ticket.dni,

    alumno:
      ticket.alumno,

    campus:
      ticket.campus,

    estado:
      ticket.estado,

    tipoConvalidacion:
      ticket.tipoConvalidacion,

    tipoIngreso:
      ticket.tipoIngreso,

    registro:
      ticket.registro,

    fechaInicio:
      ticket.fechaInicio,

    fechaFin:
      ticket.fechaFin,

    responsable:
      ticket.responsable,

    detalle:
      ticket.detalle,

    origen:
      ticket.origen,

    observacion:
      ticket.observacion,

    fechaActualizacion:
      ticket.fechaActualizacion,

    numeroCambios:
      ticket.numeroCambios,

    tiempoInicio:
      ticket.tiempoInicio,

    tiempoFin:
      ticket.tiempoFin,

    tiempoTotal:
      ticket.tiempoTotal,

    usuarioUltimaModificacion:
      ticket
        .usuarioUltimaModificacion,

    tipoReevaluacion:
      ticket.tipoReevaluacion,

    reportadoPortal:
      ticket.reportadoPortal,

    responsableAnterior:
      ticket.responsableAnterior,

    fechaReportePortal:
      ticket.fechaReportePortal,

    usuarioReportePortal:
      ticket.usuarioReportePortal
  };
}


function crearResumen(tickets) {
  const resumen = {
    total:
      tickets.length,
    enRevision: 0,
    pendiente: 0,
    enEspera: 0,
    seguimiento: 0,
    atendido: 0
  };

  tickets.forEach(
    ticket => {
      const detalle =
        normalizar(
          ticket.detalle
        );

      if (
        detalle ===
        'EN REVISION'
      ) {
        resumen.enRevision++;

      } else if (
        detalle ===
        'PENDIENTE'
      ) {
        resumen.pendiente++;

      } else if (
        detalle ===
        'EN ESPERA'
      ) {
        resumen.enEspera++;

      } else if (
        detalle ===
        'SEGUIMIENTO'
      ) {
        resumen.seguimiento++;

      } else if (
        [
          'ATENDIDO',
          'CERRADO'
        ].includes(detalle) ||
        normalizar(
          ticket.estado
        ) === 'CERRADO'
      ) {
        resumen.atendido++;
      }
    }
  );

  return resumen;
}


function obtenerTickets(
  token,
  filtros
) {
  try {
    const validacion =
      validarSesion(token);

    if (!validacion.ok) {
      return validacion;
    }

    const datos =
      leerTicketsBase();

    let tickets =
      datos.tickets;

    const f =
      filtros || {};

    const buscar =
      normalizar(
        f.buscar || ''
      );

    const responsable =
      normalizar(
        f.responsable || ''
      );

    const origen =
      normalizar(
        f.origen || ''
      );

    const detalle =
      normalizar(
        f.detalle || ''
      );

    if (buscar) {
      tickets =
        tickets.filter(
          ticket =>
            [
              ticket.numero,
              ticket.ticket,
              ticket.dni,
              ticket.alumno,
              ticket.campus,
              ticket.responsable,
              ticket.tipoTicket
            ].some(
              valor =>
                normalizar(valor)
                  .includes(buscar)
            )
        );
    }

    if (responsable) {
      tickets =
        tickets.filter(
          ticket =>
            normalizar(
              ticket.responsable
            ) === responsable
        );
    }

    if (origen) {
      tickets =
        tickets.filter(
          ticket =>
            normalizar(
              ticket.origen
            ) === origen
        );
    }

    if (detalle) {
      tickets =
        tickets.filter(
          ticket =>
            normalizar(
              ticket.detalle
            ) === detalle
        );
    }

    tickets.sort(
      (
        a,
        b
      ) =>
        Number(
          b.numero || 0
        ) -
        Number(
          a.numero || 0
        )
    );

    return {
      ok: true,
      version: VERSION,

      sesion:
        validacion.sesion,

      tickets:
        tickets.map(
          serializarTicketParaCliente_
        ),

      resumen:
        crearResumen(tickets)
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message,
      version: VERSION
    };
  }
}


/* =========================================================
   REGLA DE CARGA ACTIVA
========================================================= */

function esTicketActivoParaCarga_(
  ticket
) {
  if (!ticket) {
    return false;
  }

  const detalle =
    normalizar(
      ticket.detalle
    );

  const estado =
    normalizar(
      ticket.estado
    );

  return (
    ![
      'ATENDIDO',
      'DERIVADO',
      'CERRADO'
    ].includes(detalle) &&
    estado !== 'CERRADO'
  );
}


/* =========================================================
   ASIGNACIÓN, DISPONIBILIDAD Y PRIORIDAD
========================================================= */

/*
REGLAS PRINCIPALES

1. BASE_TICKETS:
   Si el asesor tiene un ticket En revisión,
   no está disponible.

2. SEGUIMIENTO:
   G = responsable actual.
   H = detalle actual.

   El responsable de G es la persona que actualmente
   está atendiendo el ticket.

3. PRIORIDAD DIARIA:
   - Seguimiento o En espera:
     cuenta usando FECHA ASIGNADO.
   - Atendido:
     cuenta usando FECHA FIN de BASE_TICKETS.
   - Los demás estados no cuentan para prioridad.
   - Un ticket se cuenta una sola vez.

4. ASIGNACIÓN:
   - Primero disponibilidad.
   - Entre los disponibles, menor prioridad.
   - En empate, última asignación más antigua.
   - Finalmente, orden configurado.
*/


function obtenerUsuariosAsignacion() {
  const hoja =
    asegurarEstructuraUsuariosAsignacion_();

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  if (
    hoja.getLastRow() < 2
  ) {
    return [];
  }

  const valores =
    hoja
      .getRange(
        2,
        1,
        hoja.getLastRow() - 1,
        hoja.getLastColumn()
      )
      .getDisplayValues();

  /*
   * Reconoce distintos formatos
   * equivalentes a "Sí".
   */
  const esValorActivo = valor => {
    const texto =
      normalizar(
        valor
      );

    return [
      'SI',
      'TRUE',
      'VERDADERO',
      '1',
      'ACTIVO'
    ].includes(
      texto
    );
  };

  /*
   * HABILITADO ASIGNACIÓN:
   *
   * - NO, FALSE, FALSO o 0:
   *   queda deshabilitado.
   *
   * - Vacío:
   *   se considera habilitado por defecto.
   */
  const obtenerHabilitado = valor => {
    const texto =
      normalizar(
        valor
      );

    if (!texto) {
      return true;
    }

    return ![
      'NO',
      'FALSE',
      'FALSO',
      '0',
      'INHABILITADO'
    ].includes(
      texto
    );
  };

  const usuarios =
    valores
      .map(
        (fila, indice) => {
          const usuario =
            limpiar(
              obtenerValorFila(
                fila,
                mapa,
                'USUARIO'
              )
            );

          const asesor =
            limpiar(
              obtenerValorFila(
                fila,
                mapa,
                'RESPONSABLE ASIGNADO'
              )
            );

          const rol =
            normalizar(
              obtenerValorFila(
                fila,
                mapa,
                'ROL'
              )
            );

          const activo =
            esValorActivo(
              obtenerValorFila(
                fila,
                mapa,
                'ACTIVO'
              )
            );

          const habilitado =
            obtenerHabilitado(
              obtenerValorFila(
                fila,
                mapa,
                'HABILITADO ASIGNACIÓN'
              )
            );

          const ordenTexto =
            limpiar(
              obtenerValorFila(
                fila,
                mapa,
                'ORDEN ASIGNACIÓN'
              )
            );

          const ordenNumero =
            Number(
              ordenTexto
            );

          const orden =
            Number.isFinite(
              ordenNumero
            ) &&
            ordenNumero > 0
              ? ordenNumero
              : indice + 1;

          const ultimaAsignacion =
            obtenerValorFila(
              fila,
              mapa,
              'ÚLTIMA ASIGNACIÓN'
            );

          return {
            rowNumber:
              indice + 2,

            usuario,

            asesor,

            rol,

            activo,

            habilitado,

            orden,

            ultimaAsignacion
          };
        }
      )

      /*
       * Se incluyen todos los responsables que:
       *
       * - Están activos.
       * - Tienen Responsable asignado.
       * - No son administradores.
       *
       * Importante:
       * NO se filtra por "habilitado".
       * Por eso los deshabilitados también
       * aparecerán en color plomo.
       */
      .filter(
        item => {
          const esAdministrador =
            item.rol.includes(
              'ADMIN'
            );

          return (
            item.activo &&
            Boolean(
              item.asesor
            ) &&
            !esAdministrador
          );
        }
      );

  /*
   * Evita tarjetas duplicadas cuando
   * un mismo responsable aparece asociado
   * a más de un usuario.
   */
  const gruposPorAsesor =
    {};

  usuarios.forEach(
    item => {
      const clave =
        normalizar(
          item.asesor
        );

      if (
        !gruposPorAsesor[
          clave
        ]
      ) {
        gruposPorAsesor[
          clave
        ] = [];

      }

      gruposPorAsesor[
        clave
      ].push(
        item
      );
    }
  );

  const asesoresUnicos =
    Object
      .values(
        gruposPorAsesor
      )
      .map(
        grupo => {
          /*
           * Ordena las filas duplicadas:
           *
           * 1. Menor orden configurado.
           * 2. Primera fila registrada.
           */
          grupo.sort(
            (a, b) =>
              Number(
                a.orden || 999
              ) -
                Number(
                  b.orden || 999
                ) ||
              Number(
                a.rowNumber
              ) -
                Number(
                  b.rowNumber
                )
          );

          /*
           * Usa una sola fila como representante
           * del asesor.
           */
          const representante =
            {
              ...grupo[0]
            };

          /*
           * Si existe más de un usuario
           * para el mismo responsable:
           *
           * se considera habilitado cuando
           * al menos una de sus filas está
           * habilitada.
           */
          representante.habilitado =
            grupo.some(
              item =>
                item.habilitado
            );

          /*
           * Conserva la última asignación
           * más reciente disponible.
           */
          const fechasValidas =
            grupo
              .map(
                item => ({
                  valor:
                    item.ultimaAsignacion,

                  fecha:
                    parsearFechaFlexible(
                      item.ultimaAsignacion
                    )
                })
              )
              .filter(
                item =>
                  item.fecha
              )
              .sort(
                (a, b) =>
                  b.fecha.getTime() -
                  a.fecha.getTime()
              );

          if (
            fechasValidas.length
          ) {
            representante.ultimaAsignacion =
              fechasValidas[0]
                .valor;
          }

          return representante;
        }
      );

  return asesoresUnicos.sort(
    (a, b) =>
      Number(
        a.orden || 999
      ) -
        Number(
          b.orden || 999
        ) ||
      String(
        a.asesor
      ).localeCompare(
        String(
          b.asesor
        ),
        'es'
      )
  );
}

/* =========================================================
   LECTURA DE SEGUIMIENTO OPERATIVO
========================================================= */

function encontrarIndiceSeguimiento_(
  encabezados,
  nombres,
  indicePredeterminado
) {
  for (
    let i = 0;
    i < nombres.length;
    i++
  ) {
    const buscado =
      normalizar(nombres[i]);

    const encontrado =
      encabezados.findIndex(
        encabezado =>
          normalizar(encabezado) ===
          buscado
      );

    if (encontrado >= 0) {
      return encontrado;
    }
  }

  return indicePredeterminado;
}


function leerSeguimientoOperativo_() {
  const hoja =
    obtenerArchivo()
      .getSheetByName(
        SHEET_SEGUIMIENTO
      );

  if (
    !hoja ||
    hoja.getLastRow() < 2
  ) {
    return [];
  }

  const valores =
    hoja
      .getRange(
        1,
        1,
        hoja.getLastRow(),
        hoja.getLastColumn()
      )
      .getDisplayValues();

  /*
   * Busca la fila real de encabezados
   * dentro de las primeras cinco filas.
   */
  let filaEncabezados = 0;

  for (
    let i = 0;
    i < Math.min(
      valores.length,
      5
    );
    i++
  ) {
    const filaNormalizada =
      valores[i].map(normalizar);

    if (
      filaNormalizada.includes(
        'TICKET'
      ) &&
      (
        filaNormalizada.includes(
          'DNI'
        ) ||
        filaNormalizada.includes(
          'DETALLE'
        )
      )
    ) {
      filaEncabezados = i;
      break;
    }
  }

  const encabezados =
    valores[filaEncabezados];

  const indiceTicket =
    encontrarIndiceSeguimiento_(
      encabezados,
      [
        'TICKET',
        'ID TICKET'
      ],
      1
    );

  const indiceDni =
    encontrarIndiceSeguimiento_(
      encabezados,
      ['DNI'],
      2
    );

  const indiceFechaAsignado =
    encontrarIndiceSeguimiento_(
      encabezados,
      [
        'FECHA ASIGNADO',
        'FECHA ASIGNADA'
      ],
      3
    );

  const indiceAlumno =
    encontrarIndiceSeguimiento_(
      encabezados,
      ['ALUMNO'],
      4
    );

  const indiceFechaRegistro =
    encontrarIndiceSeguimiento_(
      encabezados,
      ['FECHA REGISTRO'],
      5
    );

  /*
   * Regla indicada:
   *
   * G = índice 6 = responsable actual.
   * H = índice 7 = detalle actual.
   *
   * No se toma al responsable anterior.
   */
  const indiceResponsableActual = 6;
  const indiceDetalle = 7;

  const indicePlataforma =
    encontrarIndiceSeguimiento_(
      encabezados,
      ['PLATAFORMA'],
      8
    );

  const filas =
    valores
      .slice(
        filaEncabezados + 1
      )
      .map((fila, indice) => ({
        rowNumber:
          filaEncabezados +
          indice +
          2,

        ticket:
          limpiar(
            fila[indiceTicket]
          ),

        dni:
          limpiar(
            fila[indiceDni]
          ),

        fechaAsignado:
          limpiar(
            fila[indiceFechaAsignado]
          ),

        alumno:
          limpiar(
            fila[indiceAlumno]
          ),

        fechaRegistro:
          limpiar(
            fila[indiceFechaRegistro]
          ),

        responsableActual:
          limpiar(
            fila[
              indiceResponsableActual
            ]
          ),

        detalle:
          limpiar(
            fila[indiceDetalle]
          ),

        plataforma:
          limpiar(
            fila[indicePlataforma]
          )
      }))
      .filter(item =>
        item.ticket ||
        item.responsableActual ||
        item.detalle
      );

  /*
   * Si un ticket aparece más de una vez,
   * conserva su última fila.
   */
  const actualesPorTicket = {};

  filas.forEach(item => {
    const clave =
      item.ticket
        ? `T:${item.ticket}`
        : `F:${item.rowNumber}`;

    actualesPorTicket[clave] =
      item;
  });

  return Object.values(
    actualesPorTicket
  );
}


/* =========================================================
   REGLAS DE ESTADO
========================================================= */

/*
 * ESTADOS DE LA HOJA SEGUIMIENTO
 * QUE BLOQUEAN UNA NUEVA ASIGNACIÓN.
 *
 * No bloquean:
 * - En espera
 * - En revisión
 * - Pendiente
 *
 * Sí bloquean:
 * - Seguimiento
 * - Derivado
 * - Atendido
 * - Cerrado
 */
function detalleBloqueaDisponibilidad_(
  detalle
) {
  return [
    'SEGUIMIENTO',
    'DERIVADO',
    'ATENDIDO',
    'CERRADO'
  ].includes(
    normalizar(
      detalle
    )
  );
}


/*
 * ESTADOS DE BASE_TICKETS QUE CUENTAN
 * UTILIZANDO FECHA INICIO.
 *
 * No cuentan con FECHA INICIO:
 * - Atendido
 * - Derivado
 * - Cerrado
 *
 * Atendido se contabiliza separadamente
 * utilizando FECHA FIN.
 */
function detalleCuentaComoRecibido_(
  detalle
) {
  const detalleNormalizado =
    normalizar(
      detalle
    );

  if (!detalleNormalizado) {
    return false;
  }

  return ![
    'ATENDIDO',
    'DERIVADO',
    'CERRADO'
  ].includes(
    detalleNormalizado
  );
}


/*
 * GENERA UNA LLAVE ÚNICA PARA EL TICKET.
 *
 * Evita que un mismo ticket sea contado
 * más de una vez durante el día.
 */
function crearClaveTicketPrioridad_(
  datos
) {
  const ticket =
    limpiar(
      datos.ticket ||
      datos.idTicket
    );

  if (ticket) {
    return `T:${ticket}`;
  }

  const numero =
    limpiar(
      datos.numero
    );

  if (numero) {
    return `N:${numero}`;
  }

  const dni =
    limpiar(
      datos.dni
    );

  const alumno =
    limpiar(
      datos.alumno
    );

  if (dni || alumno) {
    return (
      `D:${dni}|` +
      `A:${alumno}|` +
      `F:${datos.rowNumber || ''}`
    );
  }

  return '';
}


/* =========================================================
   CONTEO DIARIO PARA PRIORIDAD
========================================================= */

/*
 * El conteo diario se obtiene únicamente
 * desde BASE_TICKETS.
 *
 * REGLAS:
 *
 * 1. Atendido:
 *    FECHA FIN debe ser hoy.
 *
 * 2. Derivado:
 *    No cuenta.
 *
 * 3. Cerrado:
 *    No cuenta.
 *
 * 4. Cualquier otro detalle:
 *    FECHA INICIO debe ser hoy.
 *
 * PRIORIDAD:
 *
 * 0 tickets     = Prioridad 0
 * 1 ticket      = Prioridad 1
 * 2 tickets     = Prioridad 2
 * 3 tickets     = Prioridad 3
 * 4 tickets     = Prioridad 4
 * 5 o más       = Prioridad 5
 */
function calcularConteoPrioridadHoy_(
  nombreAsesor,
  ticketsBase
) {
  const hoy =
    claveFecha(
      new Date()
    );

  /*
   * Tickets con estado diferente
   * de Atendido que cuentan por
   * FECHA INICIO.
   */
  const recibidosHoy =
    new Set();

  /*
   * Tickets Atendidos que cuentan
   * por FECHA FIN.
   */
  const atendidosHoy =
    new Set();


  ticketsBase.forEach(
    ticket => {
      /*
       * Solo se consideran los tickets
       * asignados al asesor evaluado.
       */
      if (
        normalizar(
          ticket.responsable
        ) !==
        normalizar(
          nombreAsesor
        )
      ) {
        return;
      }

      const detalle =
        normalizar(
          ticket.detalle
        );

      const clave =
        crearClaveTicketPrioridad_(
          ticket
        );

      if (!clave) {
        return;
      }


      /* ===================================================
         ATENDIDO: UTILIZA FECHA FIN
      =================================================== */

      if (
        detalle ===
        'ATENDIDO'
      ) {
        const fechaFin =
          ticket.fechaFinRaw ||
          ticket.fechaFin;

        if (
          claveFecha(
            fechaFin
          ) === hoy
        ) {
          atendidosHoy.add(
            clave
          );
        }

        return;
      }


      /* ===================================================
         DERIVADO Y CERRADO: NO CUENTAN
      =================================================== */

      if (
        detalle ===
          'DERIVADO' ||
        detalle ===
          'CERRADO'
      ) {
        return;
      }


      /* ===================================================
         OTROS ESTADOS: UTILIZAN FECHA INICIO
      =================================================== */

      if (
        !detalleCuentaComoRecibido_(
          detalle
        )
      ) {
        return;
      }

      const fechaInicio =
        ticket.fechaInicioRaw ||
        ticket.fechaInicio;

      if (
        claveFecha(
          fechaInicio
        ) === hoy
      ) {
        recibidosHoy.add(
          clave
        );
      }
    }
  );


  /*
   * Se unen ambos grupos para asegurar
   * que ningún ticket sea contado dos veces.
   */
  const totalUnico =
    new Set([
      ...recibidosHoy,
      ...atendidosHoy
    ]);

  const totalHoy =
    totalUnico.size;

  /*
   * La prioridad tiene un límite máximo de 5.
   */
  const prioridad =
    Math.min(
      totalHoy,
      5
    );

  return {
    recibidosHoy:
      recibidosHoy.size,

    atendidosHoy:
      atendidosHoy.size,

    totalHoy,

    prioridad
  };
}


/* =========================================================
   DISPONIBILIDAD DEL ASESOR
========================================================= */

function calcularEstadoOperativoAsesor(
  usuario,
  ticketsBase,
  seguimiento
) {
  const nombre =
    usuario.asesor;


  /* =====================================================
     VALIDACIÓN EN BASE_TICKETS
  ===================================================== */

  /*
   * En BASE_TICKETS únicamente bloquea:
   *
   * Detalle = En revisión.
   *
   * Esto significa que el asesor está
   * atendiendo actualmente un ticket.
   */
  const revisionBase =
    ticketsBase.filter(
      ticket =>
        normalizar(
          ticket.responsable
        ) ===
          normalizar(
            nombre
          ) &&
        normalizar(
          ticket.detalle
        ) ===
          'EN REVISION' &&
        normalizar(
          ticket.estado
        ) !==
          'CERRADO'
    );


  /* =====================================================
     VALIDACIÓN EN SEGUIMIENTO
  ===================================================== */

  /*
   * leerSeguimientoOperativo_ ya devuelve
   * solamente la última fila de cada ticket.
   *
   * Se revisa:
   *
   * - Responsable actual de la columna G.
   * - Detalle actual de la columna H.
   */
  const seguimientoAsesor =
    seguimiento.filter(
      item =>
        normalizar(
          item.responsableActual
        ) ===
        normalizar(
          nombre
        )
    );

  /*
   * El asesor no estará disponible cuando
   * en su última fila de SEGUIMIENTO exista:
   *
   * - Seguimiento
   * - Derivado
   * - Atendido
   * - Cerrado
   *
   * En espera NO bloquea.
   * En revisión NO bloquea desde esta hoja.
   * Pendiente NO bloquea.
   */
  const seguimientoBloqueante =
    seguimientoAsesor.filter(
      item =>
        detalleBloqueaDisponibilidad_(
          item.detalle
        )
    );


  /* =====================================================
     CONTEO Y PRIORIDAD DEL DÍA
  ===================================================== */

  /*
   * El conteo se realiza únicamente
   * con BASE_TICKETS.
   *
   * La hoja SEGUIMIENTO no interviene
   * en el conteo de tickets diarios.
   */
  const conteoHoy =
    calcularConteoPrioridadHoy_(
      nombre,
      ticketsBase
    );


  /* =====================================================
     DISPONIBILIDAD FINAL
  ===================================================== */

  /*
   * Para estar disponible debe cumplir:
   *
   * - Usuario activo.
   * - Asignación habilitada.
   * - No tener En revisión en BASE_TICKETS.
   * - No tener un estado bloqueante
   *   en la última fila de SEGUIMIENTO.
   */
  const disponible =
    usuario.activo &&
    usuario.habilitado &&
    revisionBase.length === 0 &&
    seguimientoBloqueante.length === 0;

  let nivel =
    'disponible';

  let texto =
    (
      `Disponible · ` +
      `Prioridad ${conteoHoy.prioridad}`
    );

  let motivo =
    (
      `${conteoHoy.totalHoy} ticket(s) ` +
      `contabilizado(s) hoy`
    );


  /* =====================================================
     MOTIVOS DE NO DISPONIBILIDAD
  ===================================================== */

  if (!usuario.activo) {
    nivel =
      'bloqueado';

    texto =
      'Usuario inactivo';

    motivo =
      'El usuario no está activo';

  } else if (
    !usuario.habilitado
  ) {
    nivel =
      'bloqueado';

    texto =
      'No participa';

    motivo =
      'Asignación deshabilitada';

  } else if (
    revisionBase.length > 0
  ) {
    nivel =
      'ocupado';

    texto =
      'En revisión atendiendo';

    motivo =
      (
        `${revisionBase.length} ticket(s) ` +
        `En revisión en BASE_TICKETS`
      );

  } else if (
    seguimientoBloqueante.length > 0
  ) {
    nivel =
      'ocupado';

    const detalles =
      [
        ...new Set(
          seguimientoBloqueante.map(
            item =>
              normalizar(
                item.detalle
              )
          )
        )
      ];

    /*
     * Se muestra el principal motivo
     * por el que está bloqueado.
     */
    if (
      detalles.includes(
        'SEGUIMIENTO'
      )
    ) {
      texto =
        'En seguimiento';

    } else if (
      detalles.includes(
        'DERIVADO'
      )
    ) {
      texto =
        'Derivado en bandeja';

    } else if (
      detalles.includes(
        'ATENDIDO'
      )
    ) {
      texto =
        'Atendido en bandeja';

    } else if (
      detalles.includes(
        'CERRADO'
      )
    ) {
      texto =
        'Cerrado en bandeja';

    } else {
      texto =
        'No disponible';
    }

    motivo =
      (
        `${seguimientoBloqueante.length} ` +
        `ticket(s) bloqueante(s) ` +
        `en SEGUIMIENTO`
      );
  }


  /* =====================================================
     TICKETS QUE CAUSAN EL BLOQUEO
  ===================================================== */

  const ticketsAfectados = [
    ...revisionBase.map(
      ticket => ({
        fuente:
          'BASE_TICKETS',

        numero:
          ticket.numero,

        ticket:
          ticket.ticket,

        alumno:
          ticket.alumno,

        detalle:
          ticket.detalle,

        responsable:
          ticket.responsable
      })
    ),

    ...seguimientoBloqueante.map(
      item => ({
        fuente:
          'SEGUIMIENTO',

        numero:
          '',

        ticket:
          item.ticket,

        alumno:
          item.alumno,

        detalle:
          item.detalle,

        responsable:
          item.responsableActual
      })
    )
  ];


  /* =====================================================
     RESULTADO FINAL
  ===================================================== */

  return {
    usuario:
      usuario.usuario,

    asesor:
      nombre,

    activo:
      usuario.activo,

    habilitado:
      usuario.habilitado,

    disponible,

    /*
     * Cantidad real de tickets contabilizados hoy.
     * Puede ser mayor de cinco.
     */
    totalAtencionesHoy:
      conteoHoy.totalHoy,

    /*
     * seleccionarSiguienteAsesor utiliza
     * asignadosHoy para decidir quién recibe
     * el siguiente ticket.
     *
     * Aquí se envía la prioridad limitada
     * entre 0 y 5.
     */
    asignadosHoy:
      conteoHoy.prioridad,

    recibidosHoy:
      conteoHoy.recibidosHoy,

    atendidosHoy:
      conteoHoy.atendidosHoy,

    prioridad:
      conteoHoy.prioridad,

    /*
     * Cantidades que bloquean actualmente
     * la asignación.
     */
    revision:
      revisionBase.length,

    seguimiento:
      seguimientoBloqueante.length,

    nivel,
    texto,
    motivo,

    orden:
      usuario.orden,

    ultimaAsignacion:
      usuario.ultimaAsignacion,

    ticketsAfectados
  };
}

/* =========================================================
   DISPONIBILIDAD DEL ASESOR
========================================================= */

function calcularEstadoOperativoAsesor(
  usuario,
  ticketsBase,
  seguimiento
) {
  const nombre =
    usuario.asesor;

  /*
   * BASE_TICKETS:
   * únicamente En revisión bloquea
   * la disponibilidad.
   */
  const revisionBase =
    ticketsBase.filter(ticket =>
      normalizar(
        ticket.responsable
      ) ===
        normalizar(nombre) &&
      normalizar(
        ticket.detalle
      ) ===
        'EN REVISION' &&
      normalizar(
        ticket.estado
      ) !==
        'CERRADO'
    );

  /*
   * SEGUIMIENTO:
   *
   * G = responsable actual.
   * H = detalle.
   */
  const seguimientoAsesor =
    seguimiento.filter(item =>
      normalizar(
        item.responsableActual
      ) ===
      normalizar(nombre)
    );

  const seguimientoBloqueante =
    seguimientoAsesor.filter(item =>
      detalleBloqueaDisponibilidad_(
        item.detalle
      )
    );

  const conteoHoy =
    calcularConteoPrioridadHoy_(
      nombre,
      ticketsBase,
      seguimiento
    );

  const disponible =
    usuario.activo &&
    usuario.habilitado &&
    revisionBase.length === 0 &&
    seguimientoBloqueante.length === 0;

  let nivel = 'disponible';
  let texto =
    `Disponible · Prioridad ${conteoHoy.prioridad}`;

  let motivo =
    `${conteoHoy.totalHoy} ticket(s) contabilizado(s) hoy`;

  if (!usuario.activo) {
    nivel = 'bloqueado';
    texto = 'Usuario inactivo';
    motivo =
      'El usuario no está activo';

  } else if (
    !usuario.habilitado
  ) {
    nivel = 'bloqueado';
    texto = 'No participa';
    motivo =
      'Asignación deshabilitada';

  } else if (
    revisionBase.length > 0
  ) {
    nivel = 'ocupado';
    texto =
      'En revisión atendiendo';

    motivo =
      `${revisionBase.length} ticket(s) En revisión en BASE_TICKETS`;

  } else if (
    seguimientoBloqueante.length > 0
  ) {
    nivel = 'ocupado';

    const detalles =
      [
        ...new Set(
          seguimientoBloqueante
            .map(item =>
              normalizar(
                item.detalle
              )
            )
        )
      ];

    if (
      detalles.includes(
        'SEGUIMIENTO'
      )
    ) {
      texto =
        'En seguimiento';

    } else if (
      detalles.includes(
        'EN ESPERA'
      )
    ) {
      texto =
        'En espera';

    } else if (
      detalles.includes(
        'ATENDIDO'
      )
    ) {
      texto =
        'Atendido en bandeja';

    } else if (
      detalles.includes(
        'CERRADO'
      )
    ) {
      texto =
        'Cerrado en bandeja';

    } else {
      texto =
        'No disponible';
    }

    motivo =
      `${seguimientoBloqueante.length} ticket(s) activo(s) en SEGUIMIENTO`;
  }

  const ticketsAfectados = [
    ...revisionBase.map(ticket => ({
      fuente:
        'BASE_TICKETS',

      numero:
        ticket.numero,

      ticket:
        ticket.ticket,

      alumno:
        ticket.alumno,

      detalle:
        ticket.detalle,

      responsable:
        ticket.responsable
    })),

    ...seguimientoBloqueante.map(item => ({
      fuente:
        'SEGUIMIENTO',

      numero:
        '',

      ticket:
        item.ticket,

      alumno:
        item.alumno,

      detalle:
        item.detalle,

      responsable:
        item.responsableActual
    }))
  ];

  return {
    usuario:
      usuario.usuario,

    asesor:
      nombre,

    activo:
      usuario.activo,

    habilitado:
      usuario.habilitado,

    disponible,

    /*
     * Este valor es el que aparece
     * como "activo(s) hoy" en el panel.
     *
     * Ya no usa el total histórico.
     */
    totalAtencionesHoy:
      conteoHoy.totalHoy,

    asignadosHoy:
      conteoHoy.totalHoy,

    recibidosHoy:
      conteoHoy.recibidosHoy,

    atendidosHoy:
      conteoHoy.atendidosHoy,

    prioridad:
      conteoHoy.prioridad,

    revision:
      revisionBase.length,

    seguimiento:
      seguimientoBloqueante.length,

    nivel,
    texto,
    motivo,

    orden:
      usuario.orden,

    ultimaAsignacion:
      usuario.ultimaAsignacion,

    ticketsAfectados
  };
}


/* =========================================================
   DISPONIBILIDAD GENERAL
========================================================= */

function obtenerDisponibilidad(
  ticketsPrecargados,
  seguimientoPrecargado
) {
  const ticketsBase =
    Array.isArray(
      ticketsPrecargados
    )
      ? ticketsPrecargados
      : leerTicketsBase()
          .tickets;

  const seguimiento =
    Array.isArray(
      seguimientoPrecargado
    )
      ? seguimientoPrecargado
      : leerSeguimientoOperativo_();

  return obtenerUsuariosAsignacion()
    .map(usuario =>
      calcularEstadoOperativoAsesor(
        usuario,
        ticketsBase,
        seguimiento
      )
    );
}


/* =========================================================
   SELECCIÓN DEL SIGUIENTE ASESOR
========================================================= */

function seleccionarSiguienteAsesor(
  excluirAsesor,
  disponibilidadPrecargada
) {
  const disponibilidad =
    Array.isArray(
      disponibilidadPrecargada
    )
      ? disponibilidadPrecargada
      : obtenerDisponibilidad();

  const elegibles =
    disponibilidad.filter(item =>
      item.activo &&
      item.habilitado &&
      item.disponible &&
      (
        !excluirAsesor ||
        normalizar(
          item.asesor
        ) !==
        normalizar(
          excluirAsesor
        )
      )
    );

  if (!elegibles.length) {
    return null;
  }

  const minimoHoy =
    Math.min(
      ...elegibles.map(item =>
        Number(
          item.asignadosHoy || 0
        )
      )
    );

  const menorPrioridad =
    elegibles.filter(item =>
      Number(
        item.asignadosHoy || 0
      ) === minimoHoy
    );

  menorPrioridad.sort(
    (a, b) => {
      const fechaA =
        parsearFechaFlexible(
          a.ultimaAsignacion
        );

      const fechaB =
        parsearFechaFlexible(
          b.ultimaAsignacion
        );

      const tiempoA =
        fechaA
          ? fechaA.getTime()
          : 0;

      const tiempoB =
        fechaB
          ? fechaB.getTime()
          : 0;

      return (
        tiempoA -
          tiempoB ||
        Number(
          a.orden || 999
        ) -
          Number(
            b.orden || 999
          )
      );
    }
  );

  return menorPrioridad[0];
}


/* =========================================================
   HABILITAR O DESHABILITAR ASESOR
========================================================= */

function actualizarHabilitadoAsignacion(
  token,
  usuario,
  habilitado
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const hoja =
      asegurarEstructuraUsuariosAsignacion_();

    const mapa =
      obtenerMapaEncabezados(
        hoja
      );

    if (hoja.getLastRow() < 2) {
      throw new Error(
        'No existen usuarios registrados'
      );
    }

    const valores =
      hoja
        .getRange(
          2,
          1,
          hoja.getLastRow() - 1,
          hoja.getLastColumn()
        )
        .getDisplayValues();

    let asesorObjetivo = '';

    /*
     * Primero encuentra al asesor relacionado
     * con el usuario seleccionado.
     */
    valores.some(
      fila => {
        const usuarioFila =
          obtenerValorFila(
            fila,
            mapa,
            'USUARIO'
          );

        if (
          normalizar(usuarioFila) ===
          normalizar(usuario)
        ) {
          asesorObjetivo =
            obtenerValorFila(
              fila,
              mapa,
              'RESPONSABLE ASIGNADO'
            );

          return true;
        }

        return false;
      }
    );

    if (!asesorObjetivo) {
      throw new Error(
        'Usuario no encontrado'
      );
    }

    /*
     * Actualiza todas las filas que pertenezcan
     * al mismo asesor. Esto también corrige
     * asesores que aparecen duplicados.
     */
    let actualizadas = 0;

    valores.forEach(
      (fila, indice) => {
        const asesorFila =
          obtenerValorFila(
            fila,
            mapa,
            'RESPONSABLE ASIGNADO'
          );

        if (
          normalizar(asesorFila) ===
          normalizar(asesorObjetivo)
        ) {
          escribirPorEncabezado_(
            hoja,
            mapa,
            indice + 2,
            'HABILITADO ASIGNACIÓN',
            habilitado
              ? 'SI'
              : 'NO'
          );

          actualizadas++;
        }
      }
    );

    if (!actualizadas) {
      throw new Error(
        'No se pudo actualizar al asesor'
      );
    }

    /*
     * Solo vuelve a calcular disponibilidad.
     * No vuelve a cargar todos los gráficos,
     * tablas y reportes del dashboard.
     */
    const disponibilidad =
      obtenerDisponibilidad();

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
            asesor:
              item.asesor,

            motivo:
              item.motivo ||
              item.texto,

            ticketsAfectados:
              item.ticketsAfectados ||
              []
          })
        );

    return {
      ok: true,

      message:
        habilitado
          ? 'Asesor habilitado'
          : 'Asesor deshabilitado',

      disponibilidad,

      disponibles:
        disponibilidad.filter(
          item =>
            item.disponible
        ).length,

      siguienteAsesor:
        seleccionarSiguienteAsesor(
          '',
          disponibilidad
        ),

      alertasAsignacion
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
   ÚLTIMA ASIGNACIÓN
========================================================= */

function actualizarUltimaAsignacionUsuario(
  asesor
) {
  const hoja =
    asegurarEstructuraUsuariosAsignacion_();

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  if (hoja.getLastRow() < 2) {
    return;
  }

  const valores =
    hoja
      .getRange(
        2,
        1,
        hoja.getLastRow() - 1,
        hoja.getLastColumn()
      )
      .getDisplayValues();

  valores.some(
    (fila, indice) => {
      if (
        normalizar(
          obtenerValorFila(
            fila,
            mapa,
            'RESPONSABLE ASIGNADO'
          )
        ) ===
        normalizar(asesor)
      ) {
        escribirPorEncabezado_(
          hoja,
          mapa,
          indice + 2,
          'ÚLTIMA ASIGNACIÓN',
          new Date()
        );

        return true;
      }

      return false;
    }
  );
}


/* =========================================================
   HISTORIAL INTERNO DE ASIGNACIONES
========================================================= */

/*
 * El gestor ya no escribirá su historial
 * dentro de la hoja operacional SEGUIMIENTO.
 *
 * Utilizará una hoja independiente:
 * HISTORIAL_ASIGNACIONES
 */
function obtenerOCrearHojaHistorialAsignaciones_() {
  return obtenerOCrearHoja_(
    'HISTORIAL_ASIGNACIONES',
    [
      'FECHA',
      'N°',
      'ID TICKET',
      'ORIGEN',
      'ASESOR',
      'USUARIO',
      'TIPO',
      'OBSERVACIÓN'
    ]
  );
}


function registrarAsignacionRotativa(
  ticket,
  asesor,
  usuario,
  tipo,
  observacion
) {
  obtenerOCrearHojaHistorialAsignaciones_()
    .appendRow([
      new Date(),
      ticket.numero,
      ticket.ticket,
      ticket.origen,
      asesor,
      usuario,
      tipo || 'ASIGNACIÓN',
      observacion || ''
    ]);
}

function obtenerPendientesAsignacionZendesk() {
  return leerTicketsBase()
    .tickets
    .filter(
      ticket =>
        normalizar(
          ticket.origen
        ) === 'ZENDESK' &&
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
        antecedente: null
      })
    );
}


function asignarTicketZendeskInterno(
  numero,
  asesor,
  usuarioEjecutor
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
      'No se encontró el ticket'
    );
  }

  if (
    normalizar(
      ticket.origen
    ) !== 'ZENDESK'
  ) {
    throw new Error(
      'El ticket no es Zendesk'
    );
  }

  if (
    limpiar(
      ticket.responsable
    )
  ) {
    throw new Error(
      'El ticket ya tiene responsable'
    );
  }

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
      new Date()
    );
  }

  escribirPorEncabezado_(
    base.hoja,
    base.mapa,
    ticket.rowNumber,
    'FECHA ACTUALIZACIÓN',
    new Date()
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
    'ZENDESK',
    'Asignación de ticket Zendesk'
  );

  return asesor;
}


function asignarTicketZendesk(
  token,
  numero,
  asesorManual
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    let asesor =
      limpiar(asesorManual);

    if (!asesor) {
      const recomendado =
        seleccionarSiguienteAsesor();

      if (!recomendado) {
        throw new Error(
          'No hay asesores disponibles'
        );
      }

      asesor =
        recomendado.asesor;
    }

    asignarTicketZendeskInterno(
      numero,
      asesor,
      validacion
        .sesion.usuario
    );

    return {
      ok: true,
      asesor,
      message:
        `Ticket asignado a ${asesor}`
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


function procesarAsignacionAutomaticaZendesk(
  token
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const pendientes =
      obtenerPendientesAsignacionZendesk();

    let asignados = 0;
    const errores = [];

    pendientes.forEach(
      ticket => {
        try {
          const asesor =
            seleccionarSiguienteAsesor();

          if (!asesor) {
            throw new Error(
              'No hay asesor disponible'
            );
          }

          asignarTicketZendeskInterno(
            ticket.numero,
            asesor.asesor,
            validacion
              .sesion.usuario
          );

          asignados++;

        } catch (error) {
          errores.push(
            `Ticket ${ticket.ticket}: ${error.message}`
          );
        }
      }
    );

    return {
      ok: true,
      asignados,
      errores,
      message:
        `${asignados} ticket(s) asignado(s)`
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
   ALERTAS DE DATOS
========================================================= */

function obtenerCamposFaltantesDatos(
  ticket
) {
  const faltantes = [];

  if (
    !limpiar(
      ticket.campus
    ) ||
    normalizar(
      ticket.campus
    ) === '#N/D'
  ) {
    faltantes.push(
      'Campus'
    );
  }

  if (
    !limpiar(
      ticket.tipoIngreso
    )
  ) {
    faltantes.push(
      'Tipo de ingreso'
    );
  }

  if (
    !limpiar(
      ticket.tipoConvalidacion
    )
  ) {
    faltantes.push(
      'Tipo de convalidación'
    );
  }

  if (
    normalizar(
      ticket.tipoTicket
    ) === 'REEVALUADO' &&
    !limpiar(
      ticket.tipoReevaluacion
    )
  ) {
    faltantes.push(
      'Tipo de reevaluación'
    );
  }

  return faltantes;
}


function obtenerTicketsDatosIncompletos() {
  return leerTicketsBase()
    .tickets
    .filter(
      ticket =>
        esTicketActivoParaCarga_(
          ticket
        ) &&
        obtenerCamposFaltantesDatos(
          ticket
        ).length
    )
    .map(
      ticket => ({
        numero:
          ticket.numero,
        ticket:
          ticket.ticket,
        dni:
          ticket.dni,
        alumno:
          ticket.alumno,
        responsable:
          ticket.responsable ||
          'Sin responsable',
        camposFaltantes:
          obtenerCamposFaltantesDatos(
            ticket
          )
      })
    );
}


function leerAlertasDatosActivas() {
  const hoja =
    obtenerOCrearHojaAlertasDatos();

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  if (
    hoja.getLastRow() < 2
  ) {
    return [];
  }

  return hoja
    .getRange(
      2,
      1,
      hoja.getLastRow() - 1,
      hoja.getLastColumn()
    )
    .getDisplayValues()
    .map(
      (
        fila,
        indice
      ) => ({
        rowNumber:
          indice + 2,

        id:
          obtenerValorFila(
            fila,
            mapa,
            'ID'
          ),

        numero:
          obtenerValorFila(
            fila,
            mapa,
            'N°'
          ),

        ticket:
          obtenerValorFila(
            fila,
            mapa,
            'ID TICKET'
          ),

        responsable:
          obtenerValorFila(
            fila,
            mapa,
            'RESPONSABLE'
          ),

        camposFaltantes:
          obtenerValorFila(
            fila,
            mapa,
            'CAMPOS FALTANTES'
          )
            .split(',')
            .map(limpiar)
            .filter(Boolean),

        estado:
          normalizar(
            obtenerValorFila(
              fila,
              mapa,
              'ESTADO'
            )
          )
      })
    )
    .filter(
      alerta =>
        alerta.estado ===
        'ACTIVA'
    );
}


function notificarDatosIncompletos(
  token,
  numeros
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    const seleccionados =
      new Set(
        (numeros || [])
          .map(
            numero =>
              String(numero)
          )
      );

    const tickets =
      obtenerTicketsDatosIncompletos()
        .filter(
          ticket =>
            seleccionados.has(
              String(
                ticket.numero
              )
            )
        );

    const hoja =
      obtenerOCrearHojaAlertasDatos();

    const mapa =
      obtenerMapaEncabezados(
        hoja
      );

    const activas =
      leerAlertasDatosActivas();

    let notificadas = 0;

    tickets.forEach(
      ticket => {
        const existente =
          activas.find(
            alerta =>
              String(
                alerta.numero
              ) ===
              String(
                ticket.numero
              )
          );

        if (existente) {
          escribirPorEncabezado_(
            hoja,
            mapa,
            existente.rowNumber,
            'CAMPOS FALTANTES',
            ticket
              .camposFaltantes
              .join(', ')
          );

          return;
        }

        hoja.appendRow([
          Utilities.getUuid(),
          ticket.numero,
          ticket.ticket,
          ticket.dni,
          ticket.alumno,
          ticket.responsable,
          ticket
            .camposFaltantes
            .join(', '),
          new Date(),
          validacion
            .sesion.usuario,
          'ACTIVA',
          ''
        ]);

        notificadas++;
      }
    );

    return {
      ok: true,
      notificadas,
      message:
        `${notificadas} notificación(es) registrada(s)`
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


function resolverAlertasDatosCompletados() {
  const incompletos =
    new Set(
      obtenerTicketsDatosIncompletos()
        .map(
          ticket =>
            String(
              ticket.numero
            )
        )
    );

  const hoja =
    obtenerOCrearHojaAlertasDatos();

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  let resueltas = 0;

  leerAlertasDatosActivas()
    .forEach(
      alerta => {
        if (
          !incompletos.has(
            String(
              alerta.numero
            )
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
}


function obtenerAlertasDatosUsuario(token) {
  try {
    const validacion =
      validarSesion(token);

    if (!validacion.ok) {
      return validacion;
    }

    resolverAlertasDatosCompletados();

    const sesion =
      validacion.sesion;

    const ticketsBase =
      leerTicketsBase()
        .tickets;

    const alertas =
      leerAlertasDatosActivas()
        .filter(
          alerta =>
            sesion.rol ===
              'ADMIN' ||
            normalizar(
              alerta.responsable
            ) ===
              normalizar(
                sesion
                  .responsableAsignado
              )
        )
        .map(
          alerta => {
            const ticket =
              ticketsBase.find(
                item =>
                  String(
                    item.numero
                  ) ===
                  String(
                    alerta.numero
                  )
              );

            return {
              numero:
                alerta.numero,
              ticket:
                alerta.ticket,
              responsable:
                alerta.responsable,
              camposFaltantes:
                alerta
                  .camposFaltantes,
              notificada: true,
              alumno:
                ticket
                  ? ticket.alumno
                  : ''
            };
          }
        );

    return {
      ok: true,
      totalNotificadas:
        alertas.length,
      tickets: alertas
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
   PORTAL
========================================================= */

function leerAlertasPortal_() {
  const hoja =
    obtenerOCrearHojaAlertasPortal_();

  const mapa =
    obtenerMapaEncabezados(
      hoja
    );

  if (
    hoja.getLastRow() < 2
  ) {
    return [];
  }

  return hoja
    .getRange(
      2,
      1,
      hoja.getLastRow() - 1,
      hoja.getLastColumn()
    )
    .getDisplayValues()
    .map(
      (
        fila,
        indice
      ) => ({
        rowNumber:
          indice + 2,

        id:
          obtenerValorFila(
            fila,
            mapa,
            'ID'
          ),

        numero:
          obtenerValorFila(
            fila,
            mapa,
            'N°'
          ),

        ticket:
          obtenerValorFila(
            fila,
            mapa,
            'ID TICKET'
          ),

        dni:
          obtenerValorFila(
            fila,
            mapa,
            'DNI'
          ),

        alumno:
          obtenerValorFila(
            fila,
            mapa,
            'ALUMNO'
          ),

        responsableAnterior:
          obtenerValorFila(
            fila,
            mapa,
            'RESPONSABLE ANTERIOR'
          ),

        fechaHora:
          obtenerValorFila(
            fila,
            mapa,
            'FECHA/HORA'
          ),

        usuarioReporto:
          obtenerValorFila(
            fila,
            mapa,
            'USUARIO QUE REPORTÓ'
          ),

        mensaje:
          obtenerValorFila(
            fila,
            mapa,
            'MENSAJE'
          ),

        estado:
          normalizar(
            obtenerValorFila(
              fila,
              mapa,
              'ESTADO'
            )
          ),

        nuevoResponsable:
          obtenerValorFila(
            fila,
            mapa,
            'NUEVO RESPONSABLE'
          )
      })
    );
}


function leerAlertasPortalPendientes_() {
  return leerAlertasPortal_()
    .filter(
      alerta =>
        alerta.estado !==
        'RESUELTA'
    );
}


function reportarTicketPortal(
  token,
  numero
) {
  try {
    const validacion =
      validarSesion(token);

    if (!validacion.ok) {
      return validacion;
    }

    const sesion =
      validacion.sesion;

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

    if (
      normalizar(
        ticket.origen
      ) !== 'PORTAL'
    ) {
      throw new Error(
        'Solo se pueden reportar tickets Portal'
      );
    }

    if (
      normalizar(
        ticket.reportadoPortal
      ) === 'SI'
    ) {
      throw new Error(
        'El ticket ya fue reportado'
      );
    }

    const esAdmin =
      sesion.rol ===
      'ADMIN';

    const esResponsable =
      normalizar(
        ticket.responsable
      ) ===
      normalizar(
        sesion
          .responsableAsignado
      );

    if (
      !esAdmin &&
      !esResponsable
    ) {
      throw new Error(
        'No tienes permiso para reportar este ticket'
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
      'RESPONSABLE ANTERIOR',
      ticket.responsable
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'FECHA REPORTE PORTAL',
      ahora
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'USUARIO REPORTE PORTAL',
      sesion.usuario
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'REPORTADO PORTAL',
      'SI'
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'Responsable',
      ''
    );

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
      sesion.usuario
    );

    obtenerOCrearHojaAlertasPortal_()
      .appendRow([
        Utilities.getUuid(),
        ticket.numero,
        ticket.ticket,
        ticket.dni,
        ticket.alumno,
        ticket.responsable,
        ahora,
        sesion.usuario,
        `Ticket Portal reportado por ${sesion.nombre || sesion.usuario}`,
        'PENDIENTE',
        '',
        '',
        ''
      ]);

    const actualizado =
      leerTicketsBase()
        .tickets
        .find(
          item =>
            String(
              item.numero
            ) ===
            String(numero)
        );

    return {
      ok: true,
      message:
        'Ticket Portal reportado y liberado correctamente',
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
  }
}


function reasignarAlertaPortal(
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

    const hojaAlertas =
      obtenerOCrearHojaAlertasPortal_();

    const mapaAlertas =
      obtenerMapaEncabezados(
        hojaAlertas
      );

    const alerta =
      leerAlertasPortal_()
        .find(
          item =>
            String(item.id) ===
              String(idAlerta) ||
            String(item.rowNumber) ===
              String(idAlerta)
        );

    if (!alerta) {
      throw new Error(
        'No se encontró la alerta'
      );
    }

    if (
      alerta.estado ===
      'RESUELTA'
    ) {
      throw new Error(
        'La alerta ya fue resuelta'
      );
    }

    let asesor =
      limpiar(asesorManual);

    if (!asesor) {
      const recomendado =
        seleccionarSiguienteAsesor(
          alerta
            .responsableAnterior
        );

      if (!recomendado) {
        throw new Error(
          'No hay asesores disponibles'
        );
      }

      asesor =
        recomendado.asesor;
    }

    const base =
      leerTicketsBase();

    const ticket =
      base.tickets.find(
        item =>
          String(item.numero) ===
          String(alerta.numero)
      );

    if (!ticket) {
      throw new Error(
        'No se encontró el ticket'
      );
    }

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'Responsable',
      asesor
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'FECHA ACTUALIZACIÓN',
      new Date()
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      ticket.rowNumber,
      'USUARIO ÚLTIMA MODIFICACIÓN',
      validacion
        .sesion.usuario
    );

    escribirPorEncabezado_(
      hojaAlertas,
      mapaAlertas,
      alerta.rowNumber,
      'ESTADO',
      'RESUELTA'
    );

    escribirPorEncabezado_(
      hojaAlertas,
      mapaAlertas,
      alerta.rowNumber,
      'NUEVO RESPONSABLE',
      asesor
    );

    escribirPorEncabezado_(
      hojaAlertas,
      mapaAlertas,
      alerta.rowNumber,
      'FECHA RESOLUCIÓN',
      new Date()
    );

    escribirPorEncabezado_(
      hojaAlertas,
      mapaAlertas,
      alerta.rowNumber,
      'USUARIO RESOLUCIÓN',
      validacion
        .sesion.usuario
    );

    actualizarUltimaAsignacionUsuario(
      asesor
    );

    registrarAsignacionRotativa(
      ticket,
      asesor,
      validacion
        .sesion.usuario,
      'PORTAL REASIGNADO',
      `Responsable anterior: ${alerta.responsableAnterior}`
    );

    return {
      ok: true,
      asesor,
      message:
        `Ticket reasignado a ${asesor}`
    };

  } catch (error) {
    return {
      ok: false,
      message:
        error.message
    };
  }
}


function procesarAlertasPortalAutomaticas(
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
          reasignarAlertaPortal(
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
            `Ticket ${alerta.ticket}: ${resultado ? resultado.message : 'Error'}`
          );
        }
      }
    );

    return {
      ok: true,
      procesadas,
      errores,
      message:
        `${procesadas} alerta(s) Portal procesada(s)`
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
   CONSULTAR Y GUARDAR TICKET
========================================================= */

/*
 * Un asesor puede editar el ticket mientras:
 *
 * - El Detalle no sea Atendido.
 * - El ESTADO TICKET no sea Cerrado.
 *
 * Esta regla no controla el campo Responsable.
 * El Responsable tiene una condición independiente.
 */
function esTicketEditablePorAsesor_(
  ticket
) {
  if (!ticket) {
    return false;
  }

  const detalle =
    normalizar(
      ticket.detalle
    );

  const estado =
    normalizar(
      ticket.estado
    );

  return (
    detalle !== 'ATENDIDO' &&
    estado !== 'CERRADO'
  );
}


/* =========================================================
   CONSULTAR UN TICKET
========================================================= */

function obtenerTicketPorNumero(
  token,
  numero
) {
  try {
    const validacion =
      validarSesion(token);

    if (!validacion.ok) {
      return validacion;
    }

    const sesion =
      validacion.sesion;

    const ticket =
      leerTicketsBase()
        .tickets
        .find(
          item =>
            String(item.numero) ===
            String(numero)
        );

    if (!ticket) {
      throw new Error(
        'No se encontró el ticket'
      );
    }

    const esAdmin =
      sesion.rol ===
      'ADMIN';

    const esPortal =
      normalizar(
        ticket.origen
      ) === 'PORTAL';

    const responsableActual =
      limpiar(
        ticket.responsable
      );

    const sinResponsable =
      !responsableActual;

    const esResponsable =
      normalizar(
        responsableActual
      ) ===
      normalizar(
        sesion.responsableAsignado
      );

    const editablePorEstado =
      esTicketEditablePorAsesor_(
        ticket
      );

    const reportado =
      normalizar(
        ticket.reportadoPortal
      ) === 'SI';

    /*
     * PORTAL LIBRE:
     *
     * El asesor puede colocar un responsable
     * solamente cuando el ticket aún no tiene uno.
     *
     * Esta posibilidad termina después
     * del primer guardado.
     */
    const puedeAsignarResponsablePortal =
      esPortal &&
      editablePorEstado &&
      sinResponsable &&
      !reportado;

    /*
     * PERMISO GENERAL DEL FORMULARIO
     *
     * Administrador:
     * puede editar cualquier ticket.
     *
     * Asesor:
     * puede editar cuando:
     *
     * 1. Es el responsable actual.
     * 2. Es un Portal libre y está realizando
     *    su primera asignación.
     *
     * El indicador REPORTADO PORTAL no bloquea
     * al nuevo responsable después de que el
     * administrador haya reasignado el ticket.
     */
    const puedeEditar =
      esAdmin ||
      (
        editablePorEstado &&
        (
          esResponsable ||
          puedeAsignarResponsablePortal
        )
      );

    /*
     * RESPONSABLE
     *
     * - Administrador: puede asignar o reasignar.
     * - Asesor: solo puede cambiarlo una vez,
     *   cuando el Portal está libre.
     */
    const puedeEditarResponsable =
      esAdmin ||
      puedeAsignarResponsablePortal;

    /*
     * El ticket puede reportarse solamente
     * cuando todavía no ha sido reportado.
     */
    const puedeReportarPortal =
      esPortal &&
      editablePorEstado &&
      !reportado &&
      (
        esAdmin ||
        esResponsable
      );

    return {
      ok: true,

      ticket:
        serializarTicketParaCliente_(
          ticket
        ),

      permisos: {
        admin:
          esAdmin,

        puedeEditar,

        soloLectura:
          !puedeEditar,

        puedeEditarResponsable,

        puedeEditarDetalle:
          puedeEditar,

        puedeFinalizar:
          false,

        puedeReportarPortal,

        reportadoPortal:
          reportado,

        puedeAsignarResponsablePortal
      }
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
   GUARDAR UN TICKET
========================================================= */

function guardarTicket(
  token,
  datos
) {
  const lock =
    LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const validacion =
      validarSesion(token);

    if (!validacion.ok) {
      return validacion;
    }

    const sesion =
      validacion.sesion;

    const numero =
      limpiar(
        datos &&
        datos.numero
      );

    if (!numero) {
      throw new Error(
        'Falta la llave N° del ticket'
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


    /* =====================================================
       PERMISOS
    ===================================================== */

    const esAdmin =
      sesion.rol ===
      'ADMIN';

    const esPortal =
      normalizar(
        ticket.origen
      ) === 'PORTAL';

    const esZendesk =
      normalizar(
        ticket.origen
      ) === 'ZENDESK';

    const editablePorEstado =
      esTicketEditablePorAsesor_(
        ticket
      );

    const reportado =
      normalizar(
        ticket.reportadoPortal
      ) === 'SI';

    const responsableAnterior =
      limpiar(
        ticket.responsable
      );

    const responsableNuevo =
      limpiar(
        datos &&
        datos.responsable
      );

    const sinResponsable =
      !responsableAnterior;

    const esResponsable =
      normalizar(
        responsableAnterior
      ) ===
      normalizar(
        sesion.responsableAsignado
      );

    /*
     * El asesor puede seleccionar un responsable
     * solamente cuando el Portal todavía está libre.
     */
    const puedeAsignarResponsablePortal =
      esPortal &&
      editablePorEstado &&
      sinResponsable &&
      !reportado;

    /*
     * El responsable actual puede continuar
     * modificando el ticket todas las veces
     * necesarias mientras no esté Atendido.
     */
    const puedeEditar =
      esAdmin ||
      (
        editablePorEstado &&
        (
          esResponsable ||
          puedeAsignarResponsablePortal
        )
      );

    if (!puedeEditar) {
      if (
        normalizar(
          ticket.detalle
        ) === 'ATENDIDO'
      ) {
        throw new Error(
          'El ticket ya está Atendido. Solo el administrador puede modificarlo.'
        );
      }

      if (
        normalizar(
          ticket.estado
        ) === 'CERRADO'
      ) {
        throw new Error(
          'El ticket está Cerrado. Solo el administrador puede modificarlo.'
        );
      }

      throw new Error(
        'No tienes permiso para modificar este ticket'
      );
    }


    /* =====================================================
       REGLAS DEL RESPONSABLE
    ===================================================== */

    if (!esAdmin) {
      /*
       * ZENDESK:
       *
       * El responsable se asigna mediante
       * el administrador o el proceso automático.
       *
       * El asesor no puede cambiarlo.
       */
      if (
        esZendesk &&
        normalizar(
          responsableNuevo
        ) !==
        normalizar(
          responsableAnterior
        )
      ) {
        throw new Error(
          'El responsable de un ticket Zendesk solo puede ser asignado por el administrador'
        );
      }

      /*
       * PORTAL LIBRE:
       *
       * En el primer guardado debe seleccionarse
       * un responsable.
       */
      if (
        puedeAsignarResponsablePortal &&
        !responsableNuevo
      ) {
        throw new Error(
          'Selecciona un responsable para el ticket Portal'
        );
      }

      /*
       * PORTAL YA ASIGNADO:
       *
       * El asesor puede continuar modificando
       * Detalle, Campus, tipos y Observación,
       * pero ya no puede cambiar Responsable.
       */
      if (
        esPortal &&
        !puedeAsignarResponsablePortal &&
        normalizar(
          responsableNuevo
        ) !==
        normalizar(
          responsableAnterior
        )
      ) {
        throw new Error(
          'El responsable ya fue asignado. Solo el administrador puede reasignarlo.'
        );
      }
    }


    /* =====================================================
       DATOS DEL FORMULARIO
    ===================================================== */

    const campus =
      limpiar(
        datos &&
        datos.campus
      );

    const tipoIngreso =
      limpiar(
        datos &&
        datos.tipoIngreso
      );

    const tipoConvalidacion =
      limpiar(
        datos &&
        datos.tipoConvalidacion
      );

    const tipoReevaluacion =
      limpiar(
        datos &&
        datos.tipoReevaluacion
      );

    const detalleNuevoTexto =
      limpiar(
        datos &&
        datos.detalle
      );

    const nuevoDetalle =
      normalizar(
        detalleNuevoTexto
      );

    const detalleAnterior =
      normalizar(
        ticket.detalle
      );

    /*
     * Los campos son obligatorios únicamente
     * para los asesores.
     *
     * El administrador puede guardar
     * un ticket incompleto.
     */
    if (!esAdmin) {
      if (
        !campus ||
        normalizar(campus) ===
          '#N/D'
      ) {
        throw new Error(
          'El Campus es obligatorio'
        );
      }

      if (!tipoIngreso) {
        throw new Error(
          'El Tipo de ingreso es obligatorio'
        );
      }

      if (!tipoConvalidacion) {
        throw new Error(
          'El Tipo de convalidación es obligatorio'
        );
      }

      if (
        normalizar(
          ticket.tipoTicket
        ) === 'REEVALUADO' &&
        !tipoReevaluacion
      ) {
        throw new Error(
          'El Tipo de reevaluación es obligatorio'
        );
      }
    }

    const fila =
      ticket.rowNumber;

    const ahora =
      new Date();


    /* =====================================================
       ACTUALIZAR DATOS GENERALES
    ===================================================== */

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
      campus
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'TIPO DE INGRESO',
      tipoIngreso
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'TIPO DE CONVALIDACIÓN',
      tipoConvalidacion
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'TIPO DE REEVALUACIÓN',
      normalizar(
        ticket.tipoTicket
      ) === 'REEVALUADO'
        ? tipoReevaluacion
        : ''
    );

    escribirPorEncabezado_(
      base.hoja,
      base.mapa,
      fila,
      'Detalle',
      detalleNuevoTexto
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


    /* =====================================================
       ACTUALIZAR RESPONSABLE
    ===================================================== */

    const cambioResponsable =
      normalizar(
        responsableAnterior
      ) !==
      normalizar(
        responsableNuevo
      );

    /*
     * El cambio se permite:
     *
     * - Siempre al administrador.
     * - Al asesor solamente en la primera
     *   asignación de un Portal libre.
     */
    if (
      cambioResponsable &&
      (
        esAdmin ||
        puedeAsignarResponsablePortal
      )
    ) {
      /*
       * Registra al responsable anterior
       * cuando realmente existía uno.
       */
      if (responsableAnterior) {
        escribirPorEncabezado_(
          base.hoja,
          base.mapa,
          fila,
          'RESPONSABLE ANTERIOR',
          responsableAnterior
        );
      }

      escribirPorEncabezado_(
        base.hoja,
        base.mapa,
        fila,
        'Responsable',
        responsableNuevo
      );

      /*
       * Registra la nueva asignación.
       */
      if (responsableNuevo) {
        actualizarUltimaAsignacionUsuario(
          responsableNuevo
        );

        registrarAsignacionRotativa(
          ticket,
          responsableNuevo,
          sesion.usuario,
          esPortal
            ? 'PORTAL'
            : 'ZENDESK',
          responsableAnterior
            ? (
                'Reasignación de ' +
                responsableAnterior +
                ' a ' +
                responsableNuevo
              )
            : (
                'Asignación a ' +
                responsableNuevo
              )
        );
      }
    }


    /* =====================================================
       TIEMPO INICIO
    ===================================================== */

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

      base.hoja
        .getRange(
          fila,
          base.mapa[
            normalizar(
              'TIEMPO INICIO'
            )
          ]
        )
        .setNumberFormat(
          'dd/MM/yyyy HH:mm:ss'
        );
    }


    /* =====================================================
       CIERRE DEL TICKET
    ===================================================== */

    if (
      nuevoDetalle ===
      'ATENDIDO'
    ) {
      /*
       * Solo genera una nueva fecha de cierre
       * cuando el ticket recién pasa a Atendido
       * o no tenía TIEMPO FIN.
       *
       * Si el administrador modifica únicamente
       * una observación de un ticket ya Atendido,
       * no altera su cierre original.
       */
      const necesitaRegistrarCierre =
        detalleAnterior !==
          'ATENDIDO' ||
        !limpiar(
          ticket.tiempoFin
        ) ||
        !limpiar(
          ticket.fechaFin
        );

      if (necesitaRegistrarCierre) {
        /*
         * TIEMPO FIN:
         * fecha y hora real del guardado.
         */
        escribirPorEncabezado_(
          base.hoja,
          base.mapa,
          fila,
          'TIEMPO FIN',
          ahora
        );

        base.hoja
          .getRange(
            fila,
            base.mapa[
              normalizar(
                'TIEMPO FIN'
              )
            ]
          )
          .setNumberFormat(
            'dd/MM/yyyy HH:mm:ss'
          );

        /*
         * FECHA FIN:
         *
         * A las 18:30 o después pasa al
         * siguiente día laboral configurado.
         */
        const fechaParaCalculo =
          new Date(
            ahora.getTime()
          );

        const minutosActuales =
          ahora.getHours() *
            60 +
          ahora.getMinutes();

        /*
         * calcularFechaOperativa_ trabaja
         * con "mayor de 18:30".
         *
         * Para incluir exactamente las 18:30,
         * se agrega un minuto solo para el cálculo.
         */
        if (
          minutosActuales ===
          HORA_CORTE_MINUTOS
        ) {
          fechaParaCalculo.setMinutes(
            fechaParaCalculo.getMinutes() +
            1
          );
        }

        const fechaFinOperativa =
          calcularFechaOperativa_(
            fechaParaCalculo
          );

        escribirPorEncabezado_(
          base.hoja,
          base.mapa,
          fila,
          'FECHA FIN',
          fechaFinOperativa
        );

        base.hoja
          .getRange(
            fila,
            base.mapa[
              normalizar(
                'FECHA FIN'
              )
            ]
          )
          .setNumberFormat(
            'dd/MM/yyyy'
          );

        const inicio =
          parsearFechaFlexible(
            ticket.tiempoInicioRaw ||
            ticket.tiempoInicio ||
            ahora
          );

        const total =
          calcularMilisegundosLaborales_(
            inicio,
            ahora
          );

        escribirPorEncabezado_(
          base.hoja,
          base.mapa,
          fila,
          'TIEMPO TOTAL',
          formatearDuracion(
            total
          )
        );
      }

    } else {
      /*
       * Si el administrador cambia Atendido
       * por cualquier otro Detalle, se eliminan:
       *
       * - FECHA FIN
       * - TIEMPO FIN
       * - TIEMPO TOTAL
       */
      escribirPorEncabezado_(
        base.hoja,
        base.mapa,
        fila,
        'TIEMPO FIN',
        ''
      );

      escribirPorEncabezado_(
        base.hoja,
        base.mapa,
        fila,
        'FECHA FIN',
        ''
      );

      escribirPorEncabezado_(
        base.hoja,
        base.mapa,
        fila,
        'TIEMPO TOTAL',
        ''
      );
    }

    /* =====================================================
       AUDITORÍA
    ===================================================== */

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

    /*
     * Termina el guardado sin volver a leer
     * toda la hoja ni procesar todas las alertas.
     */
    return {
      ok: true,

      message:
        'Ticket actualizado correctamente'
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
   FINALIZAR TICKET
========================================================= */

function finalizarTicket(
  token,
  datos
) {
  try {
    const numero =
      limpiar(
        datos &&
        datos.numero
      );

    const ticket =
      leerTicketsBase()
        .tickets
        .find(
          item =>
            String(item.numero) ===
            String(numero)
        );

    if (!ticket) {
      throw new Error(
        'No se encontró el ticket'
      );
    }

    return guardarTicket(
      token,
      {
        numero:
          ticket.numero,

        dni:
          ticket.dni,

        alumno:
          ticket.alumno,

        responsable:
          ticket.responsable,

        campus:
          ticket.campus,

        tipoIngreso:
          ticket.tipoIngreso,

        tipoConvalidacion:
          ticket.tipoConvalidacion,

        tipoReevaluacion:
          ticket.tipoReevaluacion,

        detalle:
          'Atendido',

        observacion:
          ticket.observacion
      }
    );

  } catch (error) {
    return {
      ok: false,

      message:
        error.message
    };
  }
}

/* =========================================================
   DASHBOARD
========================================================= */

function promedioDuracionTickets(
  tickets
) {
  const duraciones =
    tickets
      .map(
        ticket =>
          calcularMilisegundosLaborales_(
            ticket.tiempoInicioRaw ||
            ticket.tiempoInicio,
            ticket.tiempoFinRaw ||
            ticket.tiempoFin
          )
      )
      .filter(
        valor =>
          valor > 0
      );

  if (!duraciones.length) {
    return '0 minutos';
  }

  const promedio =
    duraciones.reduce(
      (
        suma,
        valor
      ) =>
        suma + valor,
      0
    ) /
    duraciones.length;

  return formatearDuracion(
    promedio
  );
}


function obtenerDashboardAdmin(
  token,
  filtros
) {
  try {
    const validacion =
      validarAdmin(token);

    if (!validacion.ok) {
      return validacion;
    }

    /*
     * BASE_TICKETS se lee una sola vez.
     */
    const todos =
      leerTicketsBase()
        .tickets;

    /*
     * Reutiliza los tickets que ya
     * fueron cargados.
     */
    resolverAlertasDatosCompletados(
      todos
    );

    const asesores =
      obtenerUsuariosAsignacion()
        .map(
          item =>
            item.asesor
        );

    const f =
      filtros || {};

    const mes =
      Number(
        f.mes || 0
      );

    const anio =
      Number(
        f.anio || 0
      );

    const plataforma =
      normalizar(
        f.plataforma || ''
      );

    const asesorFiltro =
      limpiar(
        f.asesor ||
        '__GLOBAL__'
      );

    /*
     * Tickets correspondientes al
     * periodo seleccionado.
     */
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

    /*
     * Tickets activos generales.
     */
    const activos =
      todos.filter(
        esTicketActivoParaCarga_
      );

    /*
     * Tickets atendidos dentro
     * del periodo seleccionado.
     */
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

    /*
     * SEGUIMIENTO se lee una sola vez.
     */
    const seguimientoOperativo =
      leerSeguimientoOperativo_();

    /*
     * Reutiliza BASE_TICKETS y
     * SEGUIMIENTO para disponibilidad.
     */
    const disponibilidad =
      obtenerDisponibilidad(
        todos,
        seguimientoOperativo
      );

    const disponibilidadAsesor =
      esGlobal
        ? {
            texto:
              'Vista global',

            nivel:
              'disponible'
          }
        : disponibilidad.find(
            item =>
              normalizar(
                item.asesor
              ) ===
              normalizar(
                asesorFiltro
              )
          ) || {
            texto:
              'Sin información',

            nivel:
              'bloqueado'
          };

    const estados = {
      enRevision:
        activosAsesor.filter(
          ticket =>
            normalizar(
              ticket.detalle
            ) === 'EN REVISION'
        ).length,

      pendiente:
        activosAsesor.filter(
          ticket =>
            normalizar(
              ticket.detalle
            ) === 'PENDIENTE'
        ).length,

      enEspera:
        activosAsesor.filter(
          ticket =>
            normalizar(
              ticket.detalle
            ) === 'EN ESPERA'
        ).length,

      seguimiento:
        activosAsesor.filter(
          ticket =>
            normalizar(
              ticket.detalle
            ) === 'SEGUIMIENTO'
        ).length,

      derivado:
        ticketsAsesor.filter(
          ticket =>
            normalizar(
              ticket.detalle
            ) === 'DERIVADO'
        ).length,

      atendido:
        atendidosAsesor.length
    };

    const plataformaAsesor = {
      zendesk:
        ticketsAsesor.filter(
          ticket =>
            normalizar(
              ticket.origen
            ) === 'ZENDESK'
        ).length,

      portal:
        ticketsAsesor.filter(
          ticket =>
            normalizar(
              ticket.origen
            ) === 'PORTAL'
        ).length,

      total:
        ticketsAsesor.length
    };


    /* =====================================================
       EVOLUCIÓN Y ATENCIÓN DIARIA
    ===================================================== */

    const diarioMapa = {};

    ticketsAsesor.forEach(
      ticket => {
        const clave =
          claveFecha(
            ticket.registroRaw ||
            ticket.registro
          );

        if (!clave) {
          return;
        }

        if (!diarioMapa[clave]) {
          diarioMapa[clave] = {
            clave,

            fecha:
              etiquetaFecha(
                ticket.registroRaw ||
                ticket.registro
              ),

            ingresoZendesk: 0,
            ingresoPortal: 0,
            totalIngresado: 0,

            atendidoZendesk: 0,
            atendidoPortal: 0,
            totalAtendido: 0
          };
        }

        const fila =
          diarioMapa[clave];

        if (
          normalizar(
            ticket.origen
          ) === 'PORTAL'
        ) {
          fila.ingresoPortal++;

        } else {
          fila.ingresoZendesk++;
        }

        fila.totalIngresado++;

        if (
          !esTicketActivoParaCarga_(
            ticket
          )
        ) {
          if (
            normalizar(
              ticket.origen
            ) === 'PORTAL'
          ) {
            fila.atendidoPortal++;

          } else {
            fila.atendidoZendesk++;
          }

          fila.totalAtendido++;
        }
      }
    );

    const diario =
      Object.values(
        diarioMapa
      )
        .sort(
          (
            a,
            b
          ) =>
            a.clave.localeCompare(
              b.clave
            )
        );


    /* =====================================================
       RANKING
    ===================================================== */

    const hoy =
      claveFecha(
        new Date()
      );

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
                  normalizar(
                    asesor
                  )
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
                cerradosHoy.filter(
                  ticket =>
                    normalizar(
                      ticket.origen
                    ) === 'ZENDESK'
                ).length,

              hoyPortal:
                cerradosHoy.filter(
                  ticket =>
                    normalizar(
                      ticket.origen
                    ) === 'PORTAL'
                ).length,

              totalHoy:
                cerradosHoy.length,

              global:
                cerrados.length
            };
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            b.global -
              a.global ||
            b.totalHoy -
              a.totalHoy
        );


    /* =====================================================
       TICKETS POR CAMPUS
    ===================================================== */

    const campusMapa = {};

    periodo.forEach(
      ticket => {
        const campus =
          limpiar(
            ticket.campus
          ) ||
          'Sin campus';

        campusMapa[campus] =
          (
            campusMapa[campus] ||
            0
          ) + 1;
      }
    );

    const campus =
      Object.entries(
        campusMapa
      )
        .map(
          (
            [
              nombre,
              total
            ]
          ) => ({
            campus:
              nombre,

            total
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            b.total -
            a.total
        );


    /* =====================================================
       ALERTAS DE ASIGNACIÓN
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
            asesor:
              item.asesor,

            motivo:
              item.motivo ||
              item.texto,

            ticketsAfectados:
              activos
                .filter(
                  ticket =>
                    normalizar(
                      ticket.responsable
                    ) ===
                    normalizar(
                      item.asesor
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

                    detalle:
                      ticket.detalle,

                    plataforma:
                      ticket.origen,

                    tipoTicket:
                      ticket.tipoTicket
                  })
                )
          })
        );

    /*
     * Reutiliza los tickets ya cargados.
     */
    const alertasDatos =
      obtenerTicketsDatosIncompletos(
        todos
      );

    const alertasPortal =
      leerAlertasPortalPendientes_();


    /* =====================================================
       RESPUESTA DEL DASHBOARD
    ===================================================== */

    return {
      ok: true,
      version: VERSION,

      filtros: {
        mes:
          f.mes || '',

        anio:
          f.anio || '',

        plataforma:
          f.plataforma || '',

        asesor:
          asesorFiltro
      },

      resumenGeneral: {
        activos:
          activos.length,

        atendidosZendesk:
          atendidos.filter(
            ticket =>
              normalizar(
                ticket.origen
              ) === 'ZENDESK'
          ).length,

        atendidosPortal:
          atendidos.filter(
            ticket =>
              normalizar(
                ticket.origen
              ) === 'PORTAL'
          ).length,

        totalAtendidos:
          atendidos.length,

        alertasPortal:
          alertasPortal.length,

        asesoresDisponibles:
          disponibilidad.filter(
            item =>
              item.disponible
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
          promedioDuracionTickets(
            atendidosAsesor
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

      pendientesAsignacionZendesk:
        obtenerPendientesAsignacionZendesk(
          todos
        ),

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

      calendarioLaboral:
        leerCalendarioLaboralInterno_()
    };

  } catch (error) {
    return {
      ok: false,

      message:
        error.message,

      version:
        VERSION
    };
  }
}

/* =========================================================
   PRUEBAS
========================================================= */

function probarCargaActiva() {
  const resultado =
    esTicketActivoParaCarga_({
      detalle:
        'PENDIENTE',
      estado:
        'ABIERTO'
    });

  Logger.log(resultado);

  return resultado;
}


function probarCargaTickets() {
  try {
    const resultado =
      leerTicketsBase();

    Logger.log(
      `Cantidad de tickets: ${resultado.tickets.length}`
    );

    return {
      ok: true,
      version: VERSION,
      cantidad:
        resultado.tickets.length,

      primerTicket:
        resultado.tickets.length
          ? serializarTicketParaCliente_(
              resultado.tickets[0]
            )
          : null
    };

  } catch (error) {
    Logger.log(
      `ERROR: ${error.message}`
    );

    return {
      ok: false,
      message:
        error.message,
      version: VERSION
    };
  }
}
