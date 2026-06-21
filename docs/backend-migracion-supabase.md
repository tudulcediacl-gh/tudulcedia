# Migración backend a Supabase - Fase 1

## Objetivo

Preparar un backend nuevo para Tu Dulce Día sin tocar producción todavía.

El sistema productivo actual sigue funcionando con:

- GitHub Pages como frontend.
- Google Apps Script como backend oficial.
- Google Sheets como base operativa.
- Endpoint productivo actual: `https://script.google.com/macros/s/AKfycbzmPICimq95KQ4GLloWbgeoonhTWBjzUM7J7kMbz32r9qiooqzC_MY4e2IADroA8Rnl/exec`.

Esta fase NO reemplaza el endpoint oficial, NO modifica los HTML productivos y NO cambia el flujo de pedidos.

## Alcance de fase 1

Se agregan archivos de preparación:

- `database/schema.sql`: modelo inicial PostgreSQL para Supabase.
- `database/seed.sql`: datos base de productos, insumos, recetas y configuración.
- `database/migration-plan.md`: plan operativo de migración.
- `scripts/migrate-from-sheets.js`: script base para transformar CSV exportados desde Google Sheets.

## Arquitectura destino

```text
GitHub Pages
  ├─ Catálogo público
  ├─ Dashboard pedidos
  ├─ Admin catálogo
  └─ Inventario/costos/producción
        ↓
API nueva / Supabase Edge Functions
        ↓
Supabase PostgreSQL
```

## Tablas principales

### Ventas y catálogo

- `clientes`
- `productos`
- `disponibilidad`
- `pedidos`
- `pedido_items`
- `configuracion_negocio`

### Inventario, costos y producción

- `insumos`
- `compras_insumos`
- `stock_movimientos`
- `recetas`
- `receta_ingredientes`
- `producciones`
- `produccion_consumos`

## Principios de diseño

1. **Pedidos con snapshot de precio**  
   Cada pedido guarda los productos comprados con nombre, precio y subtotal del momento. Así, si cambia el precio del catálogo, los pedidos antiguos no cambian.

2. **Inventario por movimientos**  
   El stock se calcula desde entradas, salidas, mermas y ajustes. No se edita un número suelto de stock como fuente principal.

3. **Costo unitario base por compra**  
   Para compras por envase:

   ```text
   cantidad_total = contenido_por_envase × envases_comprados
   costo_total = costo_por_envase × envases_comprados
   costo_base = costo_total / cantidad_total
   ```

4. **Producción no parcial**  
   Si falta cualquier ingrediente, la producción máxima es 0 y el costo del lote queda como no calculable.

5. **Margen pendiente si falta costo**  
   Nunca se debe mostrar margen 100% cuando el costo sea 0 por falta de datos. Debe mostrarse como pendiente.

6. **Normalización de insumos**  
   Se agregan columnas `nombre_normalizado` para cruzar nombres equivalentes sin confundir chips de chocolate con chips de chocolate blanco.

7. **Seguridad**  
   La `service_role_key` de Supabase nunca debe ir en GitHub ni en el frontend. Las acciones privadas deben pasar por Edge Functions o API protegida.

## No hacer en fase 1

- No modificar `index.html`.
- No modificar `admin-dashboard.html`.
- No modificar `admin-catalogo.html`.
- No modificar `admin-inventario.html`.
- No cambiar el endpoint oficial de Apps Script.
- No borrar ni reemplazar Google Sheets.
- No exponer claves Supabase en GitHub.

## Preparación en Supabase

1. Crear proyecto Supabase.
2. Ejecutar `database/schema.sql` en SQL Editor.
3. Ejecutar `database/seed.sql` en SQL Editor.
4. Revisar tablas y datos base.
5. Exportar Google Sheets a CSV.
6. Usar `scripts/migrate-from-sheets.js` para transformar datos.
7. Importar primero en ambiente de prueba.

## Variables sensibles futuras

Estas variables deben quedar en Supabase/entorno seguro, nunca en GitHub:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_TOKEN
JWT_SECRET
```

## Criterio de éxito fase 1

La fase 1 está completa cuando:

- El esquema SQL existe.
- Los datos semilla existen.
- El plan de migración está documentado.
- El script base de migración existe.
- Producción sigue funcionando igual que antes.
