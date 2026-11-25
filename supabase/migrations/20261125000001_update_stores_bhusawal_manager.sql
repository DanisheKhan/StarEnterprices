-- Migration: 20261125000001_update_stores_bhusawal_manager.sql
-- Description: Add manager_name column to stores and update city to Bhusawal, manager_name to Mazhar Sheikh, and email to owner@starenterprises.store

alter table public.stores
  add column if not exists manager_name text not null default 'Mazhar Sheikh';

update public.stores
set
  city = 'Bhusawal',
  manager_name = 'Mazhar Sheikh',
  email = 'owner@starenterprises.store',
  updated_at = now()
where code in ('mobiles', 'furniture-electronics');
