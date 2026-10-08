select 'TABLE' as kind,
  table_name as name,
  string_agg(
    column_name || ' ' || data_type || coalesce(' default ' || column_default, '') ||case
      when is_nullable = 'NO' then ' not null'
      else ''
    end,
    E',\n'
    order by ordinal_position
  ) as definition
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  )
group by table_name
union all
select 'CONSTRAINT',
  conrelid::regclass::text,
  string_agg(conname || ' ' || pg_get_constraintdef(oid), E',\n')
from pg_constraint
where connamespace = 'public'::regnamespace
group by conrelid
union all
select 'VIEW',
  viewname,
  definition
from pg_views
where schemaname = 'public'
union all
select 'FUNCTION',
  p.proname,
  pg_get_functiondef(p.oid)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
union all
select 'INDEX',
  tablename,
  string_agg(indexdef, E';\n')
from pg_indexes
where schemaname = 'public'
group by tablename
order by 1,
  2;