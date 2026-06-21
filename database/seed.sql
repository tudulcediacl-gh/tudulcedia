-- Tu Dulce Dia - Datos semilla Supabase
-- Ejecutar despues de database/schema.sql.

-- =========================
-- Configuracion negocio
-- =========================

insert into public.configuracion_negocio (clave, valor)
values
  ('whatsapp', '{"numero":"56930210411","display":"+56 9 3021 0411"}'::jsonb),
  ('transferencia', '{"nombre":"Esteban Andrés López Santibáñez","rut":"18.698.741-1","banco":"Mercado Pago","tipoCuenta":"Cuenta Vista","numeroCuenta":"1061651343","correo":"tudulcediacl@gmail.com"}'::jsonb),
  ('reglas_pedido', '{"anticipacionDiasMinima":1,"zonaHoraria":"America/Santiago"}'::jsonb)
on conflict (clave) do update set
  valor = excluded.valor,
  actualizado_en = now();

-- =========================
-- Productos actuales
-- =========================

insert into public.productos (codigo, nombre, nombre_normalizado, categoria, precio, activo, anticipacion_dias, descripcion, orden)
values
  ('GAL-VAI-CHIP', 'Galleta de vainilla con chips', public.td_normalize('Galleta de vainilla con chips'), 'galleta', 500, true, 1, 'Galleta artesanal de vainilla con chips de chocolate.', 10),
  ('GAL-VAI-NUEZ', 'Galleta vainilla nueces', public.td_normalize('Galleta vainilla nueces'), 'galleta', 600, true, 1, 'Galleta artesanal de vainilla con nueces.', 20),
  ('GAL-CHO-CHIP', 'Galleta chocolate chips', public.td_normalize('Galleta chocolate chips'), 'galleta', 500, true, 1, 'Galleta artesanal de chocolate con chips.', 30),
  ('GAL-CHO-NUEZ', 'Galleta chocolate nueces', public.td_normalize('Galleta chocolate nueces'), 'galleta', 600, true, 1, 'Galleta artesanal de chocolate con nueces.', 40),
  ('GAL-VAI-CHIP-NUEZ', 'Galleta vainilla chips y nueces', public.td_normalize('Galleta vainilla chips y nueces'), 'galleta', 700, true, 1, 'Galleta artesanal de vainilla con chips de chocolate y nueces.', 50),
  ('GAL-CHO-CHIP-NUEZ', 'Galleta chocolate chips y nueces', public.td_normalize('Galleta chocolate chips y nueces'), 'galleta', 700, true, 1, 'Galleta artesanal de chocolate con chips y nueces.', 60),
  ('PAN-MM-1KG', 'Pan masa madre 1 kg aprox.', public.td_normalize('Pan masa madre 1 kg aprox.'), 'pan', 4000, true, 1, 'Pan artesanal de masa madre, 1 kg aproximado.', 70),
  ('GAL-SUPER-150-VAI-CHIP', 'Super galleton 150 gr vainilla chip', public.td_normalize('Super galleton 150 gr vainilla chip'), 'galleta', 1500, false, 1, 'Producto inactivo histórico.', 900),
  ('GAL-VAI-CHIP-BLANCO', 'Galleta de vainilla con chips de chocolate blanco', public.td_normalize('Galleta de vainilla con chips de chocolate blanco'), 'galleta', 0, false, 1, 'Nueva variante pendiente de precio y activación.', 110),
  ('GAL-VAI-CHIP-BLANCO-NUEZ', 'Galleta de vainilla con chips de chocolate blanco y nuez', public.td_normalize('Galleta de vainilla con chips de chocolate blanco y nuez'), 'galleta', 0, false, 1, 'Nueva variante pendiente de precio y activación.', 120)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  nombre_normalizado = excluded.nombre_normalizado,
  categoria = excluded.categoria,
  precio = excluded.precio,
  activo = excluded.activo,
  anticipacion_dias = excluded.anticipacion_dias,
  descripcion = excluded.descripcion,
  orden = excluded.orden,
  actualizado_en = now();

-- =========================
-- Insumos base
-- =========================

insert into public.insumos (nombre, nombre_normalizado, categoria, unidad_base, activo)
values
  ('Harina sin polvos de hornear', public.td_normalize('Harina sin polvos de hornear'), 'Materia prima', 'g', true),
  ('Margarina', public.td_normalize('Margarina'), 'Materia prima', 'g', true),
  ('Huevos', public.td_normalize('Huevos'), 'Materia prima', 'unidad', true),
  ('Azúcar', public.td_normalize('Azúcar'), 'Materia prima', 'g', true),
  ('Polvos de hornear', public.td_normalize('Polvos de hornear'), 'Materia prima', 'g', true),
  ('Bicarbonato', public.td_normalize('Bicarbonato'), 'Materia prima', 'g', true),
  ('Chips de chocolate', public.td_normalize('Chips de chocolate'), 'Materia prima', 'g', true),
  ('Chips de chocolate blanco', public.td_normalize('Chips de chocolate blanco'), 'Materia prima', 'g', true),
  ('Nueces', public.td_normalize('Nueces'), 'Materia prima', 'g', true),
  ('Cacao en polvo', public.td_normalize('Cacao en polvo'), 'Materia prima', 'g', true),
  ('Harina de fuerza o 0000', public.td_normalize('Harina de fuerza o 0000'), 'Materia prima', 'g', true),
  ('Agua', public.td_normalize('Agua'), 'Materia prima', 'ml', true),
  ('Masa madre', public.td_normalize('Masa madre'), 'Materia prima', 'g', true),
  ('Sal', public.td_normalize('Sal'), 'Materia prima', 'g', true),
  ('Bolsas', public.td_normalize('Bolsas'), 'Packaging', 'unidad', true),
  ('Cajas', public.td_normalize('Cajas'), 'Packaging', 'unidad', true),
  ('Etiquetas', public.td_normalize('Etiquetas'), 'Packaging', 'unidad', true),
  ('Gas', public.td_normalize('Gas'), 'Servicio/Gasto', 'servicio', true),
  ('Luz', public.td_normalize('Luz'), 'Servicio/Gasto', 'servicio', true),
  ('Delivery', public.td_normalize('Delivery'), 'Servicio/Gasto', 'servicio', true)
on conflict (nombre) do update set
  nombre_normalizado = excluded.nombre_normalizado,
  categoria = excluded.categoria,
  unidad_base = excluded.unidad_base,
  activo = excluded.activo,
  actualizado_en = now();

-- =========================
-- Recetas base
-- =========================

insert into public.recetas (producto_id, producto_nombre, producto_nombre_normalizado, rendimiento, unidad_salida, activo)
select p.id, p.nombre, public.td_normalize(p.nombre), 40, 'unidades', true
from public.productos p
where p.codigo in ('GAL-VAI-CHIP', 'GAL-VAI-NUEZ', 'GAL-CHO-CHIP', 'GAL-CHO-NUEZ', 'GAL-VAI-CHIP-NUEZ', 'GAL-CHO-CHIP-NUEZ')
on conflict (producto_nombre) do update set
  producto_id = excluded.producto_id,
  producto_nombre_normalizado = excluded.producto_nombre_normalizado,
  rendimiento = excluded.rendimiento,
  unidad_salida = excluded.unidad_salida,
  activo = excluded.activo,
  actualizado_en = now();

insert into public.recetas (producto_id, producto_nombre, producto_nombre_normalizado, rendimiento, unidad_salida, activo)
select p.id, p.nombre, public.td_normalize(p.nombre), 2, 'panes', true
from public.productos p
where p.codigo = 'PAN-MM-1KG'
on conflict (producto_nombre) do update set
  producto_id = excluded.producto_id,
  producto_nombre_normalizado = excluded.producto_nombre_normalizado,
  rendimiento = excluded.rendimiento,
  unidad_salida = excluded.unidad_salida,
  activo = excluded.activo,
  actualizado_en = now();

-- Ingredientes de recetas: se eliminan y reinsertan semillas para mantener consistencia.
delete from public.receta_ingredientes
where receta_id in (
  select id from public.recetas
  where producto_nombre in (
    'Galleta de vainilla con chips',
    'Galleta vainilla nueces',
    'Galleta chocolate chips',
    'Galleta chocolate nueces',
    'Galleta vainilla chips y nueces',
    'Galleta chocolate chips y nueces',
    'Pan masa madre 1 kg aprox.'
  )
);

-- Masa base galletas para las 6 variantes.
insert into public.receta_ingredientes (receta_id, insumo_id, insumo_nombre_snapshot, cantidad, unidad)
select r.id, i.id, i.nombre, x.cantidad, x.unidad
from public.recetas r
cross join (values
  ('Harina sin polvos de hornear', 1100::numeric, 'g'),
  ('Margarina', 550::numeric, 'g'),
  ('Huevos', 4::numeric, 'unidad'),
  ('Azúcar', 750::numeric, 'g'),
  ('Polvos de hornear', 15::numeric, 'g'),
  ('Bicarbonato', 15::numeric, 'g')
) as x(nombre, cantidad, unidad)
join public.insumos i on i.nombre = x.nombre
where r.producto_nombre in (
  'Galleta de vainilla con chips',
  'Galleta vainilla nueces',
  'Galleta chocolate chips',
  'Galleta chocolate nueces',
  'Galleta vainilla chips y nueces',
  'Galleta chocolate chips y nueces'
);

-- Variantes galletas.
insert into public.receta_ingredientes (receta_id, insumo_id, insumo_nombre_snapshot, cantidad, unidad)
select r.id, i.id, i.nombre, v.cantidad, v.unidad
from (values
  ('Galleta de vainilla con chips', 'Chips de chocolate', 400::numeric, 'g'),
  ('Galleta vainilla nueces', 'Nueces', 350::numeric, 'g'),
  ('Galleta chocolate chips', 'Cacao en polvo', 140::numeric, 'g'),
  ('Galleta chocolate chips', 'Chips de chocolate', 400::numeric, 'g'),
  ('Galleta chocolate nueces', 'Cacao en polvo', 140::numeric, 'g'),
  ('Galleta chocolate nueces', 'Nueces', 350::numeric, 'g'),
  ('Galleta vainilla chips y nueces', 'Chips de chocolate', 400::numeric, 'g'),
  ('Galleta vainilla chips y nueces', 'Nueces', 350::numeric, 'g'),
  ('Galleta chocolate chips y nueces', 'Cacao en polvo', 140::numeric, 'g'),
  ('Galleta chocolate chips y nueces', 'Chips de chocolate', 400::numeric, 'g'),
  ('Galleta chocolate chips y nueces', 'Nueces', 350::numeric, 'g')
) as v(producto, insumo, cantidad, unidad)
join public.recetas r on r.producto_nombre = v.producto
join public.insumos i on i.nombre = v.insumo;

-- Pan masa madre.
insert into public.receta_ingredientes (receta_id, insumo_id, insumo_nombre_snapshot, cantidad, unidad)
select r.id, i.id, i.nombre, v.cantidad, v.unidad
from (values
  ('Harina de fuerza o 0000', 1050::numeric, 'g'),
  ('Agua', 750::numeric, 'g'),
  ('Masa madre', 250::numeric, 'g'),
  ('Sal', 30::numeric, 'g')
) as v(insumo, cantidad, unidad)
join public.recetas r on r.producto_nombre = 'Pan masa madre 1 kg aprox.'
join public.insumos i on i.nombre = v.insumo;
