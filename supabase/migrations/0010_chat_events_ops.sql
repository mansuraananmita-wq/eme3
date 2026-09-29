-- 0010_chat_events_ops.sql
-- Customer-vendor chat, recommendation events, disputes, payouts, and settings.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  vendor_id uuid not null references public.vendor_profiles (profile_id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_pair_unique unique (customer_id, vendor_id),
  constraint conversations_not_self check (customer_id <> vendor_id)
);

comment on table public.conversations is
  'One thread per customer and shop. product_id is optional context for how the thread started, not part of the unique key.';

create index conversations_vendor_id_idx on public.conversations (vendor_id);
create index conversations_product_id_idx on public.conversations (product_id);
create index conversations_created_at_idx on public.conversations (created_at desc);

create trigger set_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_body_len check (char_length(btrim(body)) between 1 and 4000)
);

comment on table public.messages is
  'Chat message. sender_id must be the customer or the vendor on the conversation.';

create index messages_conversation_id_idx on public.messages (conversation_id, created_at);
create index messages_sender_id_idx on public.messages (sender_id);
create index messages_created_at_idx on public.messages (created_at desc);
create index messages_unread_idx
  on public.messages (conversation_id)
  where read_at is null;

create trigger set_updated_at
before update on public.messages
for each row
execute function public.set_updated_at();

create table public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  session_id text not null,
  event_type public.event_type not null,
  entity_type public.entity_type not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_events_session_len check (char_length(btrim(session_id)) between 8 and 128),
  constraint user_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint user_events_search_entity check (
    event_type = 'search' or entity_id is not null
  )
);

comment on table public.user_events is
  'Append-only behavior log for recommendations later. Search events may omit entity_id. This table does not update reel or product counters.';

create index user_events_user_created_idx
  on public.user_events (user_id, created_at desc);
create index user_events_session_created_idx
  on public.user_events (session_id, created_at desc);
create index user_events_type_created_idx
  on public.user_events (event_type, created_at desc);
create index user_events_entity_idx
  on public.user_events (entity_type, entity_id);
create index user_events_created_at_idx on public.user_events (created_at desc);

create trigger set_updated_at
before update on public.user_events
for each row
execute function public.set_updated_at();

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  order_item_id uuid references public.order_items (id) on delete restrict,
  opened_by uuid not null references public.profiles (id) on delete restrict,
  reason text not null,
  status public.dispute_status not null default 'open',
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disputes_reason_len check (char_length(btrim(reason)) between 3 and 2000),
  constraint disputes_resolution_len check (
    resolution_note is null or char_length(btrim(resolution_note)) between 1 and 2000
  )
);

comment on table public.disputes is
  'Order dispute. order_item_id is optional and, when set, must belong to order_id.';

create index disputes_order_id_idx on public.disputes (order_id);
create index disputes_order_item_id_idx on public.disputes (order_item_id);
create index disputes_opened_by_idx on public.disputes (opened_by);
create index disputes_status_idx on public.disputes (status);
create index disputes_created_at_idx on public.disputes (created_at desc);

create trigger set_updated_at
before update on public.disputes
for each row
execute function public.set_updated_at();

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles (profile_id) on delete restrict,
  amount numeric(12, 2) not null,
  currency text not null default 'BDT',
  period_start date not null,
  period_end date not null,
  status public.payout_status not null default 'pending',
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payouts_amount_nonnegative check (amount >= 0),
  constraint payouts_currency_code check (currency ~ '^[A-Z]{3}$'),
  constraint payouts_period_order check (period_end >= period_start)
);

comment on table public.payouts is
  'Vendor settlement for a date range. reference is the bank or provider id once paid.';

create unique index payouts_reference_unique
  on public.payouts (reference)
  where reference is not null;

create index payouts_vendor_id_idx on public.payouts (vendor_id);
create index payouts_status_idx on public.payouts (status);
create index payouts_period_idx on public.payouts (period_start, period_end);
create index payouts_created_at_idx on public.payouts (created_at desc);

create trigger set_updated_at
before update on public.payouts
for each row
execute function public.set_updated_at();

create table public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_key_unique unique (key),
  constraint platform_settings_key_format check (key ~ '^[a-z0-9_]+$'),
  constraint platform_settings_value_not_null check (value is not null)
);

comment on table public.platform_settings is
  'Platform config such as commission and the default shipping fee. Not a place for secrets.';

create index platform_settings_created_at_idx on public.platform_settings (created_at desc);

create trigger set_updated_at
before update on public.platform_settings
for each row
execute function public.set_updated_at();

insert into public.platform_settings (key, value)
values
  ('commission_rate', '{"percent": 10}'::jsonb),
  ('default_shipping_fee', '{"amount": 60, "currency": "BDT"}'::jsonb),
  ('default_currency', '"BDT"'::jsonb);
