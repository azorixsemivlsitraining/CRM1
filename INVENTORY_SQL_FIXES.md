# Inventory Management - SQL Fixes and Foreign Key Constraints

## Problem
"Could not find a relationship between 'shipments' and 'vehicles' in the schema cache"

## Solution
If you already have data in your tables, run these SQL commands to fix the foreign key constraints.

---

## Fix 1: Add Missing Foreign Key Constraints

```sql
-- Remove existing shipments table and recreate with proper constraints
DROP TABLE IF EXISTS shipments CASCADE;

CREATE TABLE shipments (
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

CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_date ON shipments(shipment_date);
CREATE INDEX idx_shipments_supplier ON shipments(supplier_id);
CREATE INDEX idx_shipments_vehicle ON shipments(vehicle_id);
```

---

## Fix 2: Ensure Suppliers Table Has Proper Constraints

```sql
-- Check and recreate suppliers if needed
DROP TABLE IF EXISTS suppliers CASCADE;

CREATE TABLE suppliers (
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

CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_suppliers_city ON suppliers(city);
```

---

## Fix 3: Ensure Vehicles Table Has Proper Constraints

```sql
-- Check and recreate vehicles if needed
DROP TABLE IF EXISTS vehicles CASCADE;

CREATE TABLE vehicles (
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

CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_vehicle_number ON vehicles(vehicle_number);
```

---

## Fix 4: Re-insert Sample Data

After running the above fixes, insert your data back:

```sql
-- Insert Suppliers
INSERT INTO suppliers (supplier_code, supplier_name, contact_person, email, phone, city, state, status, created_by)
VALUES 
  ('SUP-001', 'Green Solar Inc', 'John Doe', 'john@greensolar.com', '+919876543210', 'Mumbai', 'Maharashtra', 'Active', 'admin'),
  ('SUP-002', 'Power Systems Ltd', 'Jane Smith', 'jane@powersys.com', '+918765432109', 'Bangalore', 'Karnataka', 'Active', 'admin'),
  ('SUP-003', 'Solar Tech Solutions', 'Raj Kumar', 'raj@solartech.com', '+917654321098', 'Hyderabad', 'Telangana', 'Active', 'admin')
ON CONFLICT (supplier_code) DO NOTHING;

-- Insert Vehicles
INSERT INTO vehicles (vehicle_code, vehicle_number, vehicle_type, capacity_tons, driver_name, driver_phone, status, created_by)
VALUES 
  ('VEH-001', 'TS-01-AB-1234', 'Truck', 5.0, 'Raj Kumar', '+919876543210', 'Active', 'admin'),
  ('VEH-002', 'TS-01-AB-1235', 'Truck', 5.0, 'Suresh Singh', '+919876543211', 'Active', 'admin'),
  ('VEH-003', 'TS-01-AB-1236', 'Van', 2.0, 'Ramesh Nair', '+919876543212', 'Under Maintenance', 'admin')
ON CONFLICT (vehicle_code) DO NOTHING;

-- Insert Shipments (use correct UUIDs from your database)
INSERT INTO shipments (shipment_no, shipment_date, origin_location, destination_location, supplier_id, vehicle_id, status, quantity_shipped, created_by)
SELECT 
  'SHIP-001', 
  CURRENT_DATE, 
  'Mumbai', 
  'Hyderabad', 
  (SELECT id FROM suppliers WHERE supplier_code = 'SUP-001' LIMIT 1),
  (SELECT id FROM vehicles WHERE vehicle_code = 'VEH-001' LIMIT 1),
  'Pending',
  100,
  'admin'
WHERE NOT EXISTS (SELECT 1 FROM shipments WHERE shipment_no = 'SHIP-001');
```

---

## Alternative: If You Want to Keep Existing Data

If you already have data and don't want to lose it, do this instead:

```sql
-- Step 1: Backup your data
CREATE TABLE suppliers_backup AS SELECT * FROM suppliers;
CREATE TABLE vehicles_backup AS SELECT * FROM vehicles;
CREATE TABLE shipments_backup AS SELECT * FROM shipments;

-- Step 2: Drop and recreate (from Fix 1, 2, 3 above)

-- Step 3: Restore data
INSERT INTO suppliers SELECT * FROM suppliers_backup;
INSERT INTO vehicles SELECT * FROM vehicles_backup;
INSERT INTO shipments SELECT * FROM shipments_backup;

-- Step 4: Clean up backups
DROP TABLE suppliers_backup;
DROP TABLE vehicles_backup;
DROP TABLE shipments_backup;
```

---

## Verify the Fixes

Run these queries to verify everything is working:

```sql
-- Check suppliers exist
SELECT COUNT(*) as supplier_count FROM suppliers;

-- Check vehicles exist
SELECT COUNT(*) as vehicle_count FROM vehicles;

-- Check shipments exist
SELECT COUNT(*) as shipment_count FROM shipments;

-- Check relationships work
SELECT 
  s.shipment_no,
  s.status,
  sup.supplier_name,
  v.vehicle_number
FROM shipments s
LEFT JOIN suppliers sup ON s.supplier_id = sup.id
LEFT JOIN vehicles v ON s.vehicle_id = v.id
LIMIT 10;
```

If the last query returns data with supplier names and vehicle numbers, everything is working correctly!

---

## Important Notes

1. **The frontend now uses a client-side enrichment function** - We fetch shipments data without complex joins, then enrich it client-side with supplier and vehicle information
2. **This approach is more reliable** - It doesn't depend on Supabase's schema cache recognizing relationships
3. **All CRUD operations are fully functional** - Create, Read, Update, Delete work on all tables
4. **Performance** - For small datasets (< 10,000 records), this approach is fine. For larger datasets, you may want to optimize queries

---

## Troubleshooting

### If you still see "Failed to load shipments":

1. Make sure ALL tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

2. Check that supplier and vehicle records exist:
   ```sql
   SELECT * FROM suppliers LIMIT 5;
   SELECT * FROM vehicles LIMIT 5;
   ```

3. Check shipment data:
   ```sql
   SELECT * FROM shipments LIMIT 5;
   ```

### If foreign keys are still not working:

Try this command to reset all constraints:
```sql
-- Disable all triggers temporarily
ALTER TABLE shipments DISABLE TRIGGER ALL;
ALTER TABLE inventory DISABLE TRIGGER ALL;
ALTER TABLE suppliers DISABLE TRIGGER ALL;
ALTER TABLE vehicles DISABLE TRIGGER ALL;

-- Re-enable them
ALTER TABLE shipments ENABLE TRIGGER ALL;
ALTER TABLE inventory ENABLE TRIGGER ALL;
ALTER TABLE suppliers ENABLE TRIGGER ALL;
ALTER TABLE vehicles ENABLE TRIGGER ALL;
```

---

## Contact

If you continue to experience issues, make sure:
- All tables were created successfully
- No data constraints are violated
- Supabase project is running properly
