create or replace function public.admin_registrar_compra_insumo(p_token text,p_insumo_id uuid,p_fecha date,p_unidad_stock text,p_contenido_por_envase numeric,p_envases_comprados numeric,p_costo_por_envase integer,p_proveedor text default null,p_observacion text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_insumo insumos; v_compra compras_insumos; v_cantidad numeric; v_total integer; v_costo_base numeric;
begin
  if not public.td_admin_token_valido(p_token) then raise exception 'Clave admin invalida'; end if;
  select * into v_insumo from insumos where id=p_insumo_id;
  if v_insumo.id is null then raise exception 'Insumo no encontrado'; end if;
  if coalesce(p_contenido_por_envase,0) <= 0 then raise exception 'Contenido debe ser mayor a cero'; end if;
  if coalesce(p_envases_comprados,0) <= 0 then raise exception 'Envases debe ser mayor a cero'; end if;
  v_cantidad := p_contenido_por_envase * p_envases_comprados;
  v_total := (coalesce(p_costo_por_envase,0) * p_envases_comprados)::integer;
  v_costo_base := case when p_contenido_por_envase > 0 then coalesce(p_costo_por_envase,0)::numeric / p_contenido_por_envase else null end;
  insert into compras_insumos(fecha,categoria,insumo_id,insumo_nombre_snapshot,unidad_stock,contenido_por_envase,envases_comprados,costo_por_envase,cantidad_total,costo_total,costo_base,proveedor,observacion)
  values(coalesce(p_fecha,current_date),v_insumo.categoria,v_insumo.id,v_insumo.nombre,coalesce(nullif(p_unidad_stock,''),v_insumo.unidad_base),p_contenido_por_envase,p_envases_comprados,coalesce(p_costo_por_envase,0),v_cantidad,v_total,v_costo_base,p_proveedor,p_observacion)
  returning * into v_compra;
  return to_jsonb(v_compra);
end;
$$;

create or replace function public.admin_upsert_receta(p_token text,p_producto_id uuid,p_producto_nombre text,p_rendimiento numeric,p_unidad_salida text default 'unidades',p_activo boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_receta recetas; v_nombre text;
begin
  if not public.td_admin_token_valido(p_token) then raise exception 'Clave admin invalida'; end if;
  v_nombre := trim(coalesce(p_producto_nombre,(select nombre from productos where id=p_producto_id)));
  if coalesce(v_nombre,'') = '' then raise exception 'Nombre receta requerido'; end if;
  if coalesce(p_rendimiento,0) <= 0 then raise exception 'Rendimiento debe ser mayor a cero'; end if;
  insert into recetas(producto_id,producto_nombre,producto_nombre_normalizado,rendimiento,unidad_salida,activo,actualizado_en)
  values(p_producto_id,v_nombre,td_normalize(v_nombre),p_rendimiento,coalesce(nullif(p_unidad_salida,''),'unidades'),coalesce(p_activo,true),now())
  on conflict (producto_nombre) do update set producto_id=excluded.producto_id,producto_nombre_normalizado=excluded.producto_nombre_normalizado,rendimiento=excluded.rendimiento,unidad_salida=excluded.unidad_salida,activo=excluded.activo,actualizado_en=now()
  returning * into v_receta;
  return to_jsonb(v_receta);
end;
$$;

grant execute on function public.admin_registrar_compra_insumo(text,uuid,date,text,numeric,numeric,integer,text,text) to anon, authenticated;
grant execute on function public.admin_upsert_receta(text,uuid,text,numeric,text,boolean) to anon, authenticated;
notify pgrst, 'reload schema';
