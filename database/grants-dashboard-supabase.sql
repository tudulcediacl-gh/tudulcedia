-- Tu Dulce Dia - Permisos para dashboard Supabase
-- Ejecutar despues de database/views-dashboard-supabase.sql

-- Permitir lectura de las vistas del dashboard desde la anon key publica.
-- Importante: estas vistas exponen datos de pedidos/clientes. Usar solo mientras el dashboard sea privado/noindex
-- o mover luego a endpoint autenticado.

grant usage on schema public to anon;
grant select on public.v_pedidos_operativos to anon;
grant select on public.v_pedidos_resumen_diario to anon;
grant select on public.v_pedidos_resumen_tipo to anon;

grant select on public.v_pedidos_operativos to authenticated;
grant select on public.v_pedidos_resumen_diario to authenticated;
grant select on public.v_pedidos_resumen_tipo to authenticated;

-- Verificacion rapida:
-- select * from public.v_pedidos_operativos limit 5;
