-- 0001_extensions_enums.sql
-- Paste this first into the Supabase SQL editor. The project must be empty.
-- Extensions live in the extensions schema, which is the Supabase default.

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;

create type public.user_role as enum ('admin', 'vendor', 'customer');

create type public.vendor_status as enum ('pending', 'approved', 'suspended');

create type public.product_status as enum ('draft', 'active', 'archived');

create type public.order_status as enum (
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);

create type public.order_item_status as enum (
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);

create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create type public.order_source as enum ('direct', 'reel', 'live');

create type public.reel_status as enum ('draft', 'published', 'removed');

create type public.live_status as enum ('scheduled', 'live', 'ended', 'removed');

create type public.event_type as enum (
  'view',
  'click',
  'add_to_cart',
  'purchase',
  'like',
  'save',
  'search',
  'watch'
);

create type public.entity_type as enum ('product', 'reel', 'live', 'category');

create type public.dispute_status as enum ('open', 'investigating', 'resolved', 'rejected');

create type public.payout_status as enum ('pending', 'paid', 'failed');
