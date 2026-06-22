create or replace function public.admin_backoffice_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.td_admin_token_valido(p_token) then
    raise exception 'Clave admin invalida';
  end if;
  return jsonb_build_object(
    'productos', coalesce((select jsonb_agg(to_jsonb(p) order by p.orden, p.nombre) from productos p), '[]'::jsonb),
    'insumos', coalesce((select jsonb_agg(to_jsonb(i) order by i.nombre) from insumos i), '[]'::jsonb),
    'recetas', coalesce((select jsonb_agg(to_jsonb(r) order by r.producto_nombre) from recetas r), '[]'::jsonb),
    'ingredientes', coalesce((select jsonb_agg(to_jsonb(ri) order by ri.receta_id, ri.insumo_nombre_snapshot) from receta_ingredientes ri), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_upsert_producto(p_token text,p_codigo text,p_nombre text,p_categoria text,p_precio integer,p_activo boolean default true,p_descripcion text default null,p_orden integer default 999,p_anticipacion_dias integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_producto productos;
begin
  if not public.td_admin_token_valido(p_token) then raise exception 'Clave admin invalida'; end if;
  if coalesce(trim(p_codigo),'') = '' then raise exception 'Codigo requerido'; end if;
  if coalesce(trim(p_nombre),'') = '' then raise exception 'Nombre requerido'; end if;
  insert into productos(codigo,nombre,nombre_normalizado,categoria,precio,activo,descripcion,orden,anticipacion_dias,actualizado_en)
  values(upper(trim(p_codigo)),trim(p_nombre),td_normalize(p_nombre),coalesce(nullif(p_categoria,''),'galleta'),coalesce(p_precio,0),coalesce(p_activo,true),p_descripcion,coalesce(p_orden,999),coalesce(p_anticipacion_dias,1),now())
  on conflict (codigo) do update set nombre=excluded.nombre,nombre_normalizado=excluded.nombre_normalizado,categoria=excluded.categoria,precio=excluded.precio,activo=excluded.activo,descripcion=excluded.descripcion,orden=excluded.orden,anticipacion_dias=excluded.anticipacion_dias,actualizado_en=now()
  returning * into v_producto;
  return to_jsonb(v_producto);
end;
$$;

create or replace function public.admin_upsert_insumo(p_token text,p_nombre text,p_categoria text default 'Materia prima',p_unidad_base text default 'g',p_activo boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_insumo insumos;
begin
  if not public.td_admin_token_valido(p_token) then raise exception 'Clave admin invalida'; end if;
  if coalesce(trim(p_nombre),'') = '' then raise exception 'Nombre insumo requerido'; end if;
  insert into insumos(nombre,nombre_normalizado,categoria,unidad_base,activo,actualizado_en)
  values(trim(p_nombre),td_normalize(p_nombre),coalesce(nullif(p_categoria,''),'Materia prima'),coalesce(nullif(p_unidad_base,''),'g'),coalesce(p_activo,true),now())
  on conflict (nombre) do update set nombre_normalizado=excluded.nombre_normalizado,categoria=excluded.categoria,unidad_base=excluded.unidad_base,activo=excluded.activo,actualizado_en=now()
  returning * into v_insumo;
  return to_jsonb(v_insumo);
end;
$$;

grant execute on function public.admin_backoffice_snapshot(text) to anon, authenticated;
grant execute on function public.admin_upsert_producto(text,text,text,text,integer,boolean,text,integer,integer) to anon, authenticated;
grant execute on function public.admin_upsert_insumo(text,text,text,text,boolean) to anon, authenticated;
notify pgrst, 'reload schema';
