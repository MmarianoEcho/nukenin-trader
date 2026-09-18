-- Nukenin Trading Co. / dados compartilhados de mercado
-- Execute no SQL Editor do projeto Supabase. Nenhum token de marketplace
-- ou anuncio individual e armazenado neste schema.

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'cardtrader',
  external_id text not null,
  game text,
  expansion text,
  name text not null,
  item_kind text not null check (item_kind in ('card', 'sealed')),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create table if not exists public.price_snapshots (
  id bigint generated always as identity primary key,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  source text not null,
  observed_at timestamptz not null default now(),
  observed_day date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  median_price numeric(14, 2) not null check (median_price >= 0),
  currency char(3) not null,
  offer_count integer not null default 0 check (offer_count >= 0),
  unique (catalog_item_id, source, observed_day)
);

create table if not exists public.view_history (
  id bigint generated always as identity primary key,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists price_snapshots_item_day_idx on public.price_snapshots (catalog_item_id, observed_day desc);
create index if not exists view_history_viewed_at_idx on public.view_history (viewed_at desc);

-- O backend local usara service role para sincronizar; nao exponha acesso anonimo.
alter table public.catalog_items enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.view_history enable row level security;

create or replace view public.daily_market_drops as
with ranked as (
  select ps.*, lag(ps.median_price) over (
    partition by ps.catalog_item_id, ps.source, ps.currency order by ps.observed_day
  ) as previous_median
  from public.price_snapshots ps
)
select ci.source, ci.external_id, ci.game, ci.expansion, ci.name, ci.item_kind,
  ci.image_url, ranked.observed_day, ranked.currency, ranked.median_price,
  ranked.previous_median,
  round(((ranked.previous_median - ranked.median_price) / nullif(ranked.previous_median, 0)) * 100, 2) as drop_percent
from ranked join public.catalog_items ci on ci.id = ranked.catalog_item_id
where ranked.previous_median > ranked.median_price;
