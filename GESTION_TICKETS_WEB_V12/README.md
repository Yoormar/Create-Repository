# GESTION_TICKETS_WEB_V12

Version de trabajo para corregir el dashboard operativo sin modificar la carpeta ORIGINAL.

## Cambios

1. DYNAMIC se incorpora al dashboard principal:
   - filtro de plataforma;
   - KPI Atendidos Dynamic;
   - barra Dynamic;
   - columna Dynamic en vista diaria.

2. Prioridad diaria:
   - usa TIEMPO INICIO como fecha real de asignacion;
   - usa FECHA INICIO solo como respaldo historico;
   - tambien reconoce cierres de hoy por FECHA FIN / TIEMPO FIN;
   - no usa acumulado historico;
   - el siguiente asesor se elige entre disponibles con menor carga de hoy.

3. Asignacion automatica:
   - ZENDESK + DYNAMIC;
   - PORTAL no se modifica;
   - el check Automatico ejecuta el proceso cada 20 segundos;
   - al activarse se oculta Actualizar dashboard porque la zona operativa se refresca automaticamente;
   - Procesar pendientes permanece como respaldo manual.

## Archivos V12

- `SistemaOperativoV12.gs`
- `SistemaOperativoV12UI.html`
- `Index.html`

## Integracion en Apps Script

El archivo `Index.html` V12 elimina las capas antiguas que competian entre si:

- `AjusteCargaDashboardUI`
- `DashboardDynamicV8UI`
- `DashboardInicioRapidoV9UI`
- `AsignacionAutomaticaV10UI`

Y conserva:

- `Scripts`
- `AjustesFinalesUI`
- `AjustesVistaUI`
- `AjusteCierreDashboardUI`
- `SistemaOperativoV12UI`

La carpeta `GESTION_TICKETS_WEB_V11/ORIGINAL` permanece sin cambios y funciona como respaldo.
