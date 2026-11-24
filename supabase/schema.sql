create table public.truck_readings (
  id bigint generated always as identity primary key,
  device_id text not null check (device_id ~ '^[a-z0-9_-]{1,40}$'),
  compartment text not null check (compartment ~ '^c[1-9]$'),
  value double precision not null check (value between 0 and 100),
  unit text not null default '%',
  distance_cm double precision,
  alert text not null default 'normal' check (alert in ('normal','baixo','transbordo','vazamento')),
  received_at timestamptz not null default now()
);
create index truck_dev_comp_time on public.truck_readings (device_id, compartment, received_at desc);
-- RLS ligado e sem policies: só a Edge Function (service_role) acessa.
alter table public.truck_readings enable row level security;
