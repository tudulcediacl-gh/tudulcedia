create or replace function public.admin_registrar_produccion(p_token text,p_receta_id uuid,p_fecha date,p_lotes numeric,p_unidades_producidas numeric,p_observacion text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receta recetas;
  v_prod producciones;
  ing receta_ingredientes;
  v_cant numeric;
  v_uni text;
begin
  if not public.td_admin_token_valido(p_token) then raise exception 'Clave admin invalida'; end if;
  select * into v_receta from recetas where id=p_receta_id;
  if v_receta.id is null then raise exception 'Receta no encontrada'; end if;

  insert into producciones(fecha,receta_id,producto_nombre_snapshot,lotes,unidades_producidas,observacion)
  values(coalesce(p_fecha,current_date),p_receta_id,v_receta.producto_nombre,coalesce(p_lotes,1),coalesce(p_unidades_producidas,0),p_observacion)
  returning * into v_prod;

  for ing in select * from receta_ingredientes where receta_id=p_receta_id loop
    v_cant := public.td_convertir_a_base(ing.cantidad * coalesce(p_lotes,1), ing.unidad);
    v_uni := public.td_unidad_base_normalizada(ing.unidad);
    insert into produccion_consumos(produccion_id,insumo_id,insumo_nombre_snapshot,cantidad_base,unidad_base,costo_total)
    values(v_prod.id,ing.insumo_id,ing.insumo_nombre_snapshot,v_cant,v_uni,null);
    insert into stock_movimientos(fecha,insumo_id,tipo,unidad_base,cantidad_base,costo_total,referencia_tipo,referencia_id,observacion)
    values(coalesce(p_fecha,current_date),ing.insumo_id,'salida',v_uni,-abs(v_cant),0,'produccion',v_prod.id,'Consumo produccion');
  end loop;

  return to_jsonb(v_prod);
end;
$$;

grant execute on function public.admin_registrar_produccion(text,uuid,date,numeric,numeric,text) to anon, authenticated;
notify pgrst, 'reload schema';
