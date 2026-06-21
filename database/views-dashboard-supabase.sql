-- Tu Dulce Dia - Vistas para dashboard Supabase
-- Ejecutar despues de database/schema.sql.

-- Vista operativa principal de pedidos.
create or replace view public.v_pedidos_operativos as
select
  p.id,
  p.folio,
  p.creado_en,
  p.actualizado_en,
  p.cliente_id,
  p.cliente_nombre,
  p.cliente_telefono,
  p.fecha_solicitada,
  p.metodo_pago,
  p.requiere_datos_transferencia,
  p.entrega_separada,
  p.nota_entrega,
  case
    when exists (
      select 1
      from public.pedido_items pi
      where pi.pedido_id = p.id
        and coalesce(pi.categoria_snapshot, '') = 'pan'
    ) and exists (
      select 1
      from public.pedido_items pi
      where pi.pedido_id = p.id
        and coalesce(pi.categoria_snapshot, '') = 'galleta'
    ) then 'Mixto'
    when exists (
      select 1
      from public.pedido_items pi
      where pi.pedido_id = p.id
        and coalesce(pi.categoria_snapshot, '') = 'pan'
    ) then 'Pan'
    when exists (
      select 1
      from public.pedido_items pi
      where pi.pedido_id = p.id
        and coalesce(pi.categoria_snapshot, '') = 'galleta'
    ) then 'Galletas'
    else 'Otro'
  end as tipo_pedido,
  p.estado,
  p.estado_pago,
  case
    when p.estado = 'Cancelado' then 'Pedido Anulado'
    when p.estado = 'Entregado' and p.estado_pago in ('Pagado', 'Comprobante recibido') then 'Entregado y pagado'
    when p.estado = 'Entregado' and p.estado_pago = 'Pago al retirar' then 'Entregado con pago al retirar'
    when p.estado_pago in ('Pagado', 'Comprobante recibido') and p.estado <> 'Entregado' then 'Pagado pendiente entrega'
    when p.estado = 'Listo para retiro/entrega' then 'Listo para entregar'
    when p.estado = 'En preparación' then 'En preparación'
    when p.estado = 'Confirmado' then 'Confirmado pendiente de pago'
    when p.estado_pago = 'Pendiente de comprobante' then 'Pendiente de pago'
    else 'Pendiente de confirmación'
  end as estado_operativo,
  p.total_estimado,
  case when p.estado = 'Cancelado' then 0 else p.total_estimado end as total_considerado,
  p.observacion,
  p.observacion_interna,
  p.origen,
  p.whatsapp_mensaje,
  coalesce(
    string_agg(
      concat(
        pi.nombre_snapshot,
        ' x ',
        pi.cantidad,
        ' - Unitario $',
        pi.precio_snapshot,
        ' - Subtotal $',
        pi.subtotal
      ),
      ' | ' order by pi.creado_en, pi.id
    ),
    ''
  ) as productos_texto,
  count(pi.id) as cantidad_items
from public.pedidos p
left join public.pedido_items pi on pi.pedido_id = p.id
group by p.id;

-- Vista resumen de ingresos activos por dia de pedido.
create or replace view public.v_pedidos_resumen_diario as
select
  date(creado_en) as fecha,
  count(*) filter (where estado <> 'Cancelado') as pedidos_activos,
  count(*) filter (where estado = 'Cancelado') as pedidos_anulados,
  coalesce(sum(case when estado <> 'Cancelado' then total_estimado else 0 end), 0) as ingreso_activo,
  count(*) filter (where estado_pago in ('Pagado', 'Comprobante recibido')) as pedidos_pagados
from public.pedidos
group by date(creado_en)
order by fecha desc;

-- Vista resumen por tipo de pedido.
create or replace view public.v_pedidos_resumen_tipo as
select
  tipo_pedido,
  count(*) filter (where estado <> 'Cancelado') as pedidos_activos,
  count(*) filter (where estado = 'Cancelado') as pedidos_anulados,
  coalesce(sum(total_considerado), 0) as ingreso_activo
from public.v_pedidos_operativos
group by tipo_pedido
order by tipo_pedido;
