create or replace function public.admin_reemplazar_ingredientes_receta(p_token text,p_receta_id uuid,p_ingredientes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare item jsonb; v_insumo insumos;
begin
  if not public.td_admin_token_valido(p_token) then raise exception 'Clave admin invalida'; end if;
  if not exists(select 1 from recetas where id=p_receta_id) then raise exception 'Receta no encontrada'; end if;
  delete from receta_ingredientes where receta_id=p_receta_id;
  for item in select * from jsonb_array_elements(coalesce(p_ingredientes,'[]'::jsonb)) loop
    select * into v_insumo from insumos where id=(item->>'insumo_id')::uuid;
    if v_insumo.id is null then raise exception 'Insumo no encontrado en ingredientes'; end if;
    insert into receta_ingredientes(receta_id,insumo_id,insumo_nombre_snapshot,cantidad,unidad)
    values(p_receta_id,v_insumo.id,v_insumo.nombre,(item->>'cantidad')::numeric,coalesce(nullif(item->>'unidad',''),v_insumo.unidad_base));
  end loop;
  return jsonb_build_object('ok',true,'receta_id',p_receta_id,'ingredientes',coalesce(jsonb_array_length(p_ingredientes),0));
end;
$$;

create or replace function public.admin_registrar_produccion(p_token text,p_receta_id uuid,p_fecha date,p_lotes numeric,p_unidades_producidas numeric,p_observacion text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_receta recetas; v_prod producciones;
begin
  if not public.td_admin_token_valido(p_token) then raise exception 'Clave admin invalida'; end if;
  select * into v_receta from recetas where id=p_receta_id;
  if v_receta.id is null then raise exception 'Receta no encontrada'; end if;
  insert into producciones(fecha,receta_id,producto_nombre_snapshot,lotes,unidades_producidas,observacion)
  values(coalesce(p_fecha,current_date),p_receta_id,v_receta.producto_nombre,coalesce(p_lotes,1),coalesce(p_unidades_producidas,0),p_observacion)
  returning * into v_prod;
  return to_jsonb(v_prod);
end;
$$;

grant execute on function public.admin_reemplazar_ingredientes_receta(text,uuid,jsonb) to anon, authenticated;
grant execute on function public.admin_registrar_produccion(text,uuid,date,numeric,numeric,text) to anon, authenticated;
notify pgrst, 'reload schema';
