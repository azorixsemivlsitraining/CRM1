-- ============================================================
-- INVENTORY MANAGEMENT SYSTEM - COMPLETE SQL SETUP
-- Run this script in Supabase SQL Editor
-- ============================================================

-- 1. CREATE SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code VARCHAR(50) NOT NULL UNIQUE,
  supplier_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  zipcode VARCHAR(10),
  country VARCHAR(100),
  payment_terms VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Active',
  rating DECIMAL(2, 1),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),
  CONSTRAINT suppliers_status_check CHECK (status IN ('Active', 'Inactive', 'Suspended'))
);

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_city ON suppliers(city);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(supplier_code);

-- 2. CREATE VEHICLES TABLE
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_code VARCHAR(50) NOT NULL UNIQUE,
  vehicle_number VARCHAR(50) NOT NULL UNIQUE,
  vehicle_type VARCHAR(100),
  make_model VARCHAR(255),
  registration_date DATE,
  capacity_tons DECIMAL(5, 2),
  driver_name VARCHAR(255),
  driver_phone VARCHAR(20),
  gps_device_id VARCHAR(100),
  fuel_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),
  CONSTRAINT vehicles_status_check CHECK (status IN ('Active', 'Inactive', 'Under Maintenance'))
);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_number ON vehicles(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_code ON vehicles(vehicle_code);

-- 3. CREATE SHIPMENTS TABLE (with proper foreign keys)
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_no VARCHAR(50) NOT NULL UNIQUE,
  shipment_date DATE NOT NULL,
  origin_location VARCHAR(255),
  destination_location VARCHAR(255),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'Pending',
  tracking_number VARCHAR(100),
  expected_delivery DATE,
  actual_delivery DATE,
  quantity_shipped INTEGER,
  quantity_received INTEGER,
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),
  CONSTRAINT shipments_status_check CHECK (status IN ('Pending', 'Shipped', 'In Transit', 'Delivered', 'Cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(shipment_date);
CREATE INDEX IF NOT EXISTS idx_shipments_supplier ON shipments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_shipments_vehicle ON shipments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_shipments_no ON shipments(shipment_no);

-- 4. CREATE INVENTORY TABLE
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code VARCHAR(50) NOT NULL UNIQUE,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 50,
  location VARCHAR(255),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  unit_price DECIMAL(10, 2),
  cost_price DECIMAL(10, 2),
  description TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),
  CONSTRAINT inventory_category_check CHECK (category IN ('Solar Panels', 'Inverters', 'Cables', 'Mounting Hardware', 'Electrical Components', 'Other'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_item_code ON inventory(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier ON inventory(supplier_id);

-- 5. CREATE INVENTORY MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL,
  item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  movement_type VARCHAR(50),
  quantity INTEGER,
  from_location VARCHAR(255),
  to_location VARCHAR(255),
  reference_no VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),
  CONSTRAINT movements_type_check CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'))
);

CREATE INDEX IF NOT EXISTS idx_movements_date ON inventory_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_movements_item ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory_movements(movement_type);

-- 6. CREATE REPORT METRICS TABLE
CREATE TABLE IF NOT EXISTS report_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50),
  report_date DATE,
  metric_name VARCHAR(100),
  metric_value DECIMAL(15, 2),
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT metrics_type_check CHECK (report_type IN ('Daily', 'Weekly', 'Monthly'))
);

CREATE INDEX IF NOT EXISTS idx_metrics_type ON report_metrics(report_type);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON report_metrics(report_date);

-- ============================================================
-- INSERT SAMPLE DATA
-- ============================================================

-- Insert Sample Suppliers
INSERT INTO suppliers (supplier_code, supplier_name, contact_person, email, phone, city, state, status, created_by)
VALUES 
  ('SUP-001', 'Green Solar Inc', 'John Doe', 'john@greensolar.com', '+919876543210', 'Mumbai', 'Maharashtra', 'Active', 'admin'),
  ('SUP-002', 'Power Systems Ltd', 'Jane Smith', 'jane@powersys.com', '+918765432109', 'Bangalore', 'Karnataka', 'Active', 'admin'),
  ('SUP-003', 'Solar Tech Solutions', 'Raj Kumar', 'raj@solartech.com', '+917654321098', 'Hyderabad', 'Telangana', 'Active', 'admin')
ON CONFLICT (supplier_code) DO NOTHING;

-- Insert Sample Vehicles
INSERT INTO vehicles (vehicle_code, vehicle_number, vehicle_type, capacity_tons, driver_name, driver_phone, status, created_by)
VALUES 
  ('VEH-001', 'TS-01-AB-1234', 'Truck', 5.0, 'Raj Kumar', '+919876543210', 'Active', 'admin'),
  ('VEH-002', 'TS-01-AB-1235', 'Truck', 5.0, 'Suresh Singh', '+919876543211', 'Active', 'admin'),
  ('VEH-003', 'TS-01-AB-1236', 'Van', 2.0, 'Ramesh Nair', '+919876543212', 'Under Maintenance', 'admin')
ON CONFLICT (vehicle_code) DO NOTHING;

-- Insert Sample Inventory Items
INSERT INTO inventory (item_code, item_name, category, quantity, reorder_level, location, unit_price, created_by)
VALUES 
  ('SOL-001', 'Solar Panel 400W', 'Solar Panels', 50, 20, 'Hyderabad', 15000.00, 'admin'),
  ('INV-001', 'Hybrid Inverter 5kW', 'Inverters', 30, 10, 'Hyderabad', 75000.00, 'admin'),
  ('CAB-001', 'Single Core Cable 6mm', 'Cables', 500, 200, 'Bangalore', 50.00, 'admin'),
  ('MNT-001', 'Mounting Structure (per unit)', 'Mounting Hardware', 100, 30, 'Chennai', 3500.00, 'admin'),
  ('ELC-001', 'DC Isolator Switch', 'Electrical Components', 200, 75, 'Hyderabad', 2500.00, 'admin')
ON CONFLICT (item_code) DO NOTHING;

-- Insert Sample Shipments (use correct IDs)
INSERT INTO shipments (shipment_no, shipment_date, origin_location, destination_location, supplier_id, vehicle_id, status, quantity_shipped, tracking_number, created_by)
SELECT 
  'SHIP-001', 
  CURRENT_DATE, 
  'Mumbai', 
  'Hyderabad', 
  (SELECT id FROM suppliers WHERE supplier_code = 'SUP-001' LIMIT 1),
  (SELECT id FROM vehicles WHERE vehicle_code = 'VEH-001' LIMIT 1),
  'Pending',
  100,
  'TRK001',
  'admin'
WHERE NOT EXISTS (SELECT 1 FROM shipments WHERE shipment_no = 'SHIP-001');

INSERT INTO shipments (shipment_no, shipment_date, origin_location, destination_location, supplier_id, vehicle_id, status, quantity_shipped, tracking_number, created_by)
SELECT 
  'SHIP-002', 
  CURRENT_DATE - INTERVAL '1 day', 
  'Bangalore', 
  'Chennai', 
  (SELECT id FROM suppliers WHERE supplier_code = 'SUP-002' LIMIT 1),
  (SELECT id FROM vehicles WHERE vehicle_code = 'VEH-002' LIMIT 1),
  'In Transit',
  75,
  'TRK002',
  'admin'
WHERE NOT EXISTS (SELECT 1 FROM shipments WHERE shipment_no = 'SHIP-002');

INSERT INTO shipments (shipment_no, shipment_date, origin_location, destination_location, supplier_id, vehicle_id, status, quantity_shipped, quantity_received, tracking_number, actual_delivery, created_by)
SELECT 
  'SHIP-003', 
  CURRENT_DATE - INTERVAL '5 days', 
  'Hyderabad', 
  'Bangalore', 
  (SELECT id FROM suppliers WHERE supplier_code = 'SUP-003' LIMIT 1),
  (SELECT id FROM vehicles WHERE vehicle_code = 'VEH-002' LIMIT 1),
  'Delivered',
  50,
  50,
  'TRK003',
  CURRENT_DATE - INTERVAL '3 days',
  'admin'
WHERE NOT EXISTS (SELECT 1 FROM shipments WHERE shipment_no = 'SHIP-003');

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (Optional)
-- ============================================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- VERIFY SETUP
-- ============================================================

-- Count records in each table
SELECT 'suppliers' as table_name, COUNT(*) as count FROM suppliers
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory;

-- Test the relationship query (this is what the frontend will do internally)
SELECT 
  s.shipment_no,
  s.shipment_date,
  s.status,
  s.origin_location,
  s.destination_location,
  s.quantity_shipped,
  sup.supplier_name,
  v.vehicle_number,
  v.driver_name
FROM shipments s
LEFT JOIN suppliers sup ON s.supplier_id = sup.id
LEFT JOIN vehicles v ON s.vehicle_id = v.id
ORDER BY s.shipment_date DESC;
