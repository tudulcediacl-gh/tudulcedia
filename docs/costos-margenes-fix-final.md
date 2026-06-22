# Fix final costos y margenes

Fecha: 2026-06-21

## Problema corregido

Los costos de recetas aparecian inflados porque algunas recetas tenian cantidades grandes marcadas como kg cuando en realidad representaban gramos.

Ademas, algunos costos base venian expresados en unidad de compra, por ejemplo kg, y debian normalizarse a gramos para las recetas.

## Correccion aplicada en Supabase

Se corrigieron las vistas:

- v_costo_unitario_insumos
- v_costo_recetas
- v_margen_pedidos

## Resultado esperado

El costo receta debe quedar en valores razonables para 40 unidades y no en millones de pesos.

## Estado

Validado manualmente por usuario: corregido.
