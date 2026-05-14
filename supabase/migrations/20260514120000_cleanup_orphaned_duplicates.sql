-- Orphaned rows: unchecked but still carrying a duplicate_count.
-- The untick handler now deletes rows instead of upserting checked:false,
-- so these can never recur. This migration clears the existing orphans.
--
-- Verify before running:
--   select count(*) from collection_entries where checked = false and duplicate_count > 0;
-- Expect: 1
--
-- Verify after running:
--   select count(*) from collection_entries where checked = false and duplicate_count > 0;
-- Expect: 0

delete from collection_entries
where checked = false
  and duplicate_count > 0;
