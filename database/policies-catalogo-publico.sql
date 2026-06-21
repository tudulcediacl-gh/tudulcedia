-- Tu Dulce Dia - Politicas publicas de solo lectura para catalogo
-- Fase 2 segura: permite leer productos activos desde Supabase usando anon key.
-- Ejecutar en Supabase SQL Editor despues de schema.sql, seed.sql e import historico.
--
-- No permite insertar, editar ni borrar datos.
-- No abre pedidos, clientes, inventario privado ni costos.

-- =========================
-- Permisos base para PostgREST
-- =========================
-- Las politicas RLS definen que filas puede ver anon.
-- Los GRANT definen que el rol anon puede consultar la tabla.
-- Sin estos GRANT, Supabase responde 401/42501 permission denied.

grant usage on schema public to anon, authenticated;
grant select on table public.productos to anon, authenticated;
grant select on table public.configuracion_negocio to anon, authenticated;

-- =========================
-- Productos publicos activos
-- =========================

alter table public.productos enable row level security;

drop policy if exists "Catalogo publico puede leer productos activos" on public.productos;

create policy "Catalogo publico puede leer productos activos"
on public.productos
for select
to anon, authenticated
using (activo = true);

-- =========================
-- Configuracion publica minima
-- =========================
-- Solo permite leer claves necesarias para el catalogo publico.
-- Por ahora: whatsapp y reglas_pedido.
-- No expone datos de clientes, pedidos, compras ni stock.

alter table public.configuracion_negocio enable row level security;

drop policy if exists "Catalogo publico puede leer configuracion minima" on public.configuracion_negocio;

create policy "Catalogo publico puede leer configuracion minima"
on public.configuracion_negocio
for select
to anon, authenticated
using (clave in ('whatsapp', 'reglas_pedido'));

-- =========================
-- Verificacion rapida
-- =========================
-- Ejecutar despues de crear las politicas:
--
-- select codigo, nombre, precio, activo
-- from public.productos
-- where activo = true
-- order by orden;
--
-- Esperado: productos activos solamente.
