# GESTION_TICKETS_WEB V11

Carpeta de trabajo separada para no tocar el sistema actualmente desplegado.

## Estructura

- `ORIGINAL/`: copia de los archivos actuales entregados por la usuaria.
- `V11/`: versión consolidada/corregida.
- `SistemaV11.gs`: backend adicional para dashboard rápido, DYNAMIC y asignación automática Zendesk + DYNAMIC.

## Reglas V11

- PORTAL conserva su lógica actual.
- ZENDESK y DYNAMIC se asignan automáticamente.
- El dashboard incluye DYNAMIC.
- Se evita la cadena de parches V8/V9/V10 que sobrescribían las mismas funciones.
- No aplicar a producción hasta validar primero en Apps Script.
