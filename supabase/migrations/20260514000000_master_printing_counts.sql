create or replace function master_printing_counts()
returns table(set_id text, count bigint)
language sql stable
security definer
as $$
  select set_id, count(*)::bigint
  from printings
  where collection_tier = 'master'
  group by set_id;
$$;
