# Plan operativo de migración de datos

## Estado actual

Producción continúa usando Google Apps Script + Google Sheets. El endpoint oficial NO se reemplaza en esta fase.

## Objetivo de esta migración

Preparar el traspaso desde Google Sheets a Supabase PostgreSQL de manera verificable y reversible.

## Orden recomendado

### 1. Respaldar producción

Antes de cualquier importación:

- Exportar Google Sheets completo como `.xlsx`.
- Exportar cada hoja importante como `.csv`.
- Guardar copia local y copia en Drive.
- No borrar hojas antiguas.

Hojas esperadas o equivalentes:

- Pedidos.
- Productos.
- Disponibilidad.
- Compras/Insumos.
- Stock.
- Recetas.
- Producciones.
- Configuración.

### 2. Crear proyecto Supabase

- Plan inicial: Free.
- Zona horaria lógica del negocio: `America/Santiago`.
- Ejecutar `database/schema.sql`.
- Ejecutar `database/seed.sql`.

### 3. Validar semillas

Comprobar:

- Productos activos e inactivos.
- Insumos base.
- Recetas de galletas.
- Receta de pan masa madre.
- Datos de transferencia.
- WhatsApp oficial: `56930210411`.

### 4. Transformar CSV

Usar `scripts/migrate-from-sheets.js` para generar archivos normalizados.

Ejemplo esperado:

```bash
node scripts/migrate-from-sheets.js ./exports ./dist-migration
```

Salida estimada:

```text
clientes.json
pedidos.json
pedido_items.json
productos.json
compras_insumos.json
recetas.json
```

### 5. Importar en ambiente de prueba

No importar primero en producción.

Validar:

- Cantidad de pedidos.
- Total vendido histórico.
- Pedidos cancelados/anulados como ingreso 0.
- Folios únicos.
- Productos por pedido.
- Compras y costos base.
- Stock calculado.
- Recetas sin ingredientes faltantes.

### 6. Pruebas funcionales

Antes de cambiar frontend:

- Registrar pedido de prueba.
- Confirmar folio real.
- Validar detalle de pedido.
- Cambiar estado.
- Cambiar estado de pago.
- Registrar compra.
- Registrar producción.
- Ver descuento de stock.
- Calcular margen.

### 7. Migración gradual del frontend

No se debe cambiar todo junto.

Orden sugerido:

1. Catálogo solo lectura desde Supabase.
2. Registro de pedidos nuevos en Supabase.
3. Dashboard pedidos.
4. Admin catálogo.
5. Inventario/costos/producción.
6. Apagar escritura en Apps Script.
7. Dejar Sheets como respaldo histórico.

## Criterios de rollback

Si algo falla:

- Mantener endpoint Apps Script como fuente productiva.
- Revertir cambios de frontend si ya existieran.
- No borrar datos de Supabase; marcar como prueba si corresponde.
- Reimportar desde CSV si hay inconsistencias.

## Reglas críticas

- No exponer claves Supabase privadas en GitHub.
- No guardar `service_role_key` en frontend.
- No cambiar WhatsApp oficial.
- No usar endpoints antiguos.
- No calcular margen si falta costo o receta.
- No permitir producción parcial si falta ingrediente.
- No borrar pedidos anulados.
