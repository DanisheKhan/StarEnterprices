-- Migration: 20261125000002_index_product_units_store_status.sql
-- Description: Composite index for fast serial unit lookups by store, status, and creation order

create index if not exists idx_product_units_store_status_created
  on public.product_units (store_id, status, created_at desc);
