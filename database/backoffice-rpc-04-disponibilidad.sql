create or replace function public.admin_upsert_disponibilidad(
  p_token text,
  p_fecha date,
  p_estado text default 'Abierto',
  p_cupo_maximo integer default null,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row disponibilidad;
begin
  if not public.td_admin_token_valido(p_token) then
    raise exception 'Clave admin invalida';
  end if;
  if p_fecha is null then
    raise exception 'Fecha requerida';
  end if;

  insert into disponibilidad(fecha,estado,cupo_maximo,nota,actualizado_en)
  values(p_fecha,coalesce(nullif(p_estado,''),'Abierto'),p_cupo_maximo,p_nota,now())
  on conflict (fecha) do update set
    estado=excluded.estado,
    cupo_maximo=excluded.cupo_maximo,
    nota=excluded.nota,
    actualizado_en=now()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.admin_upsert_disponibilidad(text,date,text,integer,text) to anon, authenticated;
notify pgrst, 'reload schema';
