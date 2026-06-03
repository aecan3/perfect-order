-- Enable trigram extension for fuzzy card-name matching in search_tradeable_printings.
-- GIN index keeps similarity scans fast as cards table grows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_cards_name_trgm ON cards USING gin (name gin_trgm_ops);
