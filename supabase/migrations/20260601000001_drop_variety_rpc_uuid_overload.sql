-- Drop the stale uuid[] overload left over from the first migration attempt.
-- CREATE OR REPLACE only replaces when the argument types match exactly;
-- the first version had exclude_printing_ids uuid[] while the corrected
-- version has text[], so PostgreSQL kept both. PostgREST returns HTTP 300
-- (Multiple Choices) when it finds more than one matching overload.
DROP FUNCTION IF EXISTS get_marketplace_variety_for_user(uuid, text, uuid[], int);
