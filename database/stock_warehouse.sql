-- Stock Warehouse schema and useful queries

-- Enable extension for gen_random_uuid
create extension if not exists "pgcrypto";

-- helper to auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- locations (warehouse sites)
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  state text,
  country text default 'India',
  postal_code text,
  latitude numeric,
  longitude numeric,
  contact_email text,
  contact_phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_locations_name on locations(lower(name));
create trigger trg_locations_updated_at before update on locations for each row execute function update_updated_at();

-- settings (warehouse area, dispatch time etc.)
create table if not exists settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- core inventory
create table if not exists stock_warehouse (
  id uuid primary key default gen_random_uuid(),
  sku text,
  item_name text not null,
  quantity integer not null default 0,
  location_id uuid references locations(id) on delete set null,
  location_text text,
  condition text,
  batch_no text,
  notes text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_stock_sku on stock_warehouse(lower(sku));
create index if not exists idx_stock_item_name on stock_warehouse(lower(item_name));
create index if not exists idx_stock_location_id on stock_warehouse(location_id);
create trigger trg_stock_updated_at before update on stock_warehouse for each row execute function update_updated_at();

-- procurements (incoming purchases)
create table if not exists procurements (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  sku text,
  quantity integer not null default 0,
  supplier text,
  purchase_date date,
  price numeric(14,2),
  currency text default 'INR',
  reference text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_procurements_supplier on procurements(lower(supplier));
create trigger trg_procurements_updated_at before update on procurements for each row execute function update_updated_at();

-- purchase_orders
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier text,
  items jsonb,
  order_date date,
  expected_delivery date,
  total_amount numeric(14,2),
  currency text default 'INR',
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger trg_purchase_orders_updated_at before update on purchase_orders for each row execute function update_updated_at();

-- supplier_invoices
create table if not exists supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text,
  supplier text,
  invoice_date date,
  amount numeric(14,2),
  currency text default 'INR',
  status text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_invoices_number on supplier_invoices(lower(invoice_number));
create trigger trg_supplier_invoices_updated_at before update on supplier_invoices for each row execute function update_updated_at();

-- purchase_returns
create table if not exists purchase_returns (
  id uuid primary key default gen_random_uuid(),
  reference_id text,
  supplier text,
  date date,
  amount numeric(14,2),
  reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger trg_purchase_returns_updated_at before update on purchase_returns for each row execute function update_updated_at();

-- logistics (shipments)
create table if not exists logistics (
  id uuid primary key default gen_random_uuid(),
  reference text,
  carrier text,
  tracking_number text,
  shipment_date date,
  expected_arrival date,
  origin_location_id uuid references locations(id),
  destination_location_id uuid references locations(id),
  status text,
  items jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_logistics_tracking on logistics(lower(tracking_number));
create trigger trg_logistics_updated_at before update on logistics for each row execute function update_updated_at();

-- cost entries (per-unit costing)
create table if not exists cost_entries (
  id uuid primary key default gen_random_uuid(),
  item_name text,
  sku text,
  material_cost numeric(14,2) default 0,
  logistics_cost numeric(14,2) default 0,
  per_unit_cost numeric(14,2) default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_cost_sku on cost_entries(lower(sku));
create trigger trg_cost_entries_updated_at before update on cost_entries for each row execute function update_updated_at();

-- modules/inventory details
create table if not exists modules_inventory (
  id uuid primary key default gen_random_uuid(),
  sku text,
  model text,
  manufacturer text,
  serial_numbers jsonb,
  quantity integer not null default 0,
  location_id uuid references locations(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_modules_sku on modules_inventory(lower(sku));
create trigger trg_modules_inventory_updated_at before update on modules_inventory for each row execute function update_updated_at();

-- Useful SELECT queries / analytics

-- quick stats
-- select coalesce(sum(quantity),0) as total_units, count(distinct lower(coalesce(sku,item_name))) as unique_skus
-- from stock_warehouse;

-- stock by location
-- select l.name as location, coalesce(sum(s.quantity),0) as total_units
-- from locations l
-- left join stock_warehouse s on s.location_id = l.id
-- group by l.name
-- order by total_units desc;

-- items ready to ship (quantity > 0)
-- select * from stock_warehouse where quantity > 0 order by quantity desc limit 200;

-- low stock alert (threshold param)
-- select * from stock_warehouse where quantity <= 10 order by quantity asc;

-- SKU summary with last updated
-- select coalesce(sku,item_name) as sku_or_name, sum(quantity) as total_qty, max(updated_at) as last_update
-- from stock_warehouse
-- group by coalesce(sku,item_name)
-- order by total_qty desc;

-- procurement recent (last 30 days)
-- select * from procurements where purchase_date >= current_date - interval '30 days' order by purchase_date desc;

-- open purchase orders
-- select * from purchase_orders where status in ('pending','processing') order by order_date desc;

-- logistics shipments in-transit
-- select * from logistics where status in ('in-transit','dispatched') order by shipment_date desc;

-- per-location inventory details (with address)
-- select s.*, l.name, l.address from stock_warehouse s left join locations l on s.location_id = l.id order by l.name, s.item_name;

-- configuration lookups
-- select value from settings where key = 'warehouse_area_sqft';
-- select value from settings where key = 'dispatch_time';

-- Example seed inserts
-- insert into locations (name, address, city, state, contact_email)
-- values ('Hyderabad Warehouse','Some address, Hyderabad','Hyderabad','Telangana','logistics@axisogreen.in');

-- insert into settings (key, value) values ('warehouse_area_sqft','20000') on conflict (key) do update set value = excluded.value;
-- insert into settings (key, value) values ('dispatch_time','Same-day / 24 hrs') on conflict (key) do update set value = excluded.value;
