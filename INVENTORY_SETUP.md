# Inventory Management System - SQL Setup Guide

This guide contains all SQL queries needed to set up the inventory management system in Supabase.

## Overview

The inventory management system includes:
- **Inventory**: Manage stock items (solar panels, inverters, cables, etc.)
- **Suppliers**: Manage supplier/vendor details
- **Shipments**: Track shipments and deliveries
- **Vehicles**: Manage transport vehicles
- **Inventory Movements**: Track inventory transactions
- **Reports**: Metrics and reporting data

## Setup Instructions

1. Go to your Supabase Dashboard
2. Navigate to the **SQL Editor**
3. Copy and paste the SQL schemas below
4. Execute each query sequentially

---

## SQL Schemas

### 1. INVENTORY TABLE

```sql
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code VARCHAR(50) NOT NULL UNIQUE,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 50,
  location VARCHAR(255),
  supplier_id UUID,
  unit_price DECIMAL(10, 2),
  cost_price DECIMAL(10, 2),
  description TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),
  CONSTRAINT inventory_category_check CHECK (category IN ('Solar Panels', 'Inverters', 'Cables', 'Mounting Hardware', 'Electrical Components', 'Other'))
);

CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_item_code ON inventory(item_code);
CREATE INDEX idx_inventory_location ON inventory(location);
```

### 2. SUPPLIERS TABLE

```sql
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

CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_suppliers_city ON suppliers(city);
```

### 3. SHIPMENTS TABLE

```sql
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_no VARCHAR(50) NOT NULL UNIQUE,
  shipment_date DATE NOT NULL,
  origin_location VARCHAR(255),
  destination_location VARCHAR(255),
  supplier_id UUID REFERENCES suppliers(id),
  vehicle_id UUID,
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
```

### 4. VEHICLES TABLE

```sql
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

CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_vehicle_number ON vehicles(vehicle_number);
```

### 5. INVENTORY MOVEMENTS TABLE

```sql
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL,
  item_id UUID REFERENCES inventory(id),
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

CREATE INDEX idx_movements_date ON inventory_movements(movement_date);
CREATE INDEX idx_movements_item ON inventory_movements(item_id);
CREATE INDEX idx_movements_type ON inventory_movements(movement_type);
```

### 6. REPORT METRICS TABLE

```sql
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

CREATE INDEX idx_metrics_type ON report_metrics(report_type);
CREATE INDEX idx_metrics_date ON report_metrics(report_date);
```

### 7. Enable Row Level Security (RLS)

```sql
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_metrics ENABLE ROW LEVEL SECURITY;
```

---

## Sample Data Insertion

### Insert Sample Inventory Items

```sql
INSERT INTO inventory (item_code, item_name, category, quantity, reorder_level, location, unit_price, created_by)
VALUES 
  ('SOL-001', 'Solar Panel 400W', 'Solar Panels', 50, 20, 'Hyderabad', 15000.00, 'admin'),
  ('INV-001', 'Hybrid Inverter 5kW', 'Inverters', 30, 10, 'Hyderabad', 75000.00, 'admin'),
  ('CAB-001', 'Single Core Cable 6mm', 'Cables', 500, 200, 'Bangalore', 50.00, 'admin'),
  ('MNT-001', 'Mounting Structure (per unit)', 'Mounting Hardware', 100, 30, 'Chennai', 3500.00, 'admin');
```

### Insert Sample Suppliers

```sql
INSERT INTO suppliers (supplier_code, supplier_name, contact_person, email, phone, city, state, status, created_by)
VALUES 
  ('SUP-001', 'Green Solar Inc', 'John Doe', 'john@greensolar.com', '+919876543210', 'Mumbai', 'Maharashtra', 'Active', 'admin'),
  ('SUP-002', 'Power Systems Ltd', 'Jane Smith', 'jane@powersys.com', '+918765432109', 'Bangalore', 'Karnataka', 'Active', 'admin'),
  ('SUP-003', 'Solar Tech Solutions', 'Raj Kumar', 'raj@solartech.com', '+917654321098', 'Hyderabad', 'Telangana', 'Active', 'admin');
```

### Insert Sample Vehicles

```sql
INSERT INTO vehicles (vehicle_code, vehicle_number, vehicle_type, capacity_tons, driver_name, driver_phone, status, created_by)
VALUES 
  ('VEH-001', 'TS-01-AB-1234', 'Truck', 5.0, 'Raj Kumar', '+919876543210', 'Active', 'admin'),
  ('VEH-002', 'TS-01-AB-1235', 'Truck', 5.0, 'Suresh Singh', '+919876543211', 'Active', 'admin'),
  ('VEH-003', 'TS-01-AB-1236', 'Van', 2.0, 'Ramesh Nair', '+919876543212', 'Under Maintenance', 'admin');
```

### Insert Sample Shipment

```sql
INSERT INTO shipments (shipment_no, shipment_date, origin_location, destination_location, supplier_id, vehicle_id, status, quantity_shipped, created_by)
SELECT 
  'SHIP-001', 
  CURRENT_DATE, 
  'Mumbai', 
  'Hyderabad', 
  (SELECT id FROM suppliers WHERE supplier_code = 'SUP-001'),
  (SELECT id FROM vehicles WHERE vehicle_code = 'VEH-001'),
  'Pending',
  100,
  'admin';
```

---

## Useful Queries

### Get Low Stock Items

```sql
SELECT * FROM inventory 
WHERE quantity <= reorder_level 
ORDER BY quantity ASC;
```

### Get Active Suppliers by City

```sql
SELECT * FROM suppliers 
WHERE city = 'Hyderabad' AND status = 'Active' 
ORDER BY supplier_name;
```

### Get Pending Shipments

```sql
SELECT s.*, v.vehicle_number, sup.supplier_name
FROM shipments s
LEFT JOIN vehicles v ON s.vehicle_id = v.id
LEFT JOIN suppliers sup ON s.supplier_id = sup.id
WHERE s.status IN ('Pending', 'Shipped', 'In Transit')
ORDER BY s.shipment_date DESC;
```

### Daily Shipment Report

```sql
SELECT 
  DATE(shipment_date) as date,
  status,
  COUNT(*) as count,
  SUM(quantity_shipped) as total_quantity
FROM shipments
WHERE DATE(shipment_date) = CURRENT_DATE
GROUP BY DATE(shipment_date), status;
```

### Weekly Shipment Report

```sql
SELECT 
  DATE_TRUNC('week', shipment_date) as week,
  status,
  COUNT(*) as shipment_count,
  SUM(quantity_shipped) as total_quantity,
  SUM(quantity_received) as total_received
FROM shipments
WHERE shipment_date >= CURRENT_DATE - INTERVAL '8 weeks'
GROUP BY DATE_TRUNC('week', shipment_date), status
ORDER BY week DESC;
```

### Monthly Shipment Report

```sql
SELECT 
  DATE_TRUNC('month', shipment_date) as month,
  status,
  COUNT(*) as shipment_count,
  SUM(quantity_shipped) as total_quantity,
  SUM(quantity_received) as total_received
FROM shipments
WHERE shipment_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', shipment_date), status
ORDER BY month DESC;
```

### Inventory Stock Report by Category

```sql
SELECT 
  category,
  COUNT(*) as item_count,
  SUM(quantity) as total_quantity,
  AVG(unit_price) as avg_unit_price,
  SUM(quantity * unit_price) as total_value
FROM inventory
GROUP BY category
ORDER BY total_value DESC;
```

### Pending vs Completed Shipments

```sql
SELECT 
  status,
  COUNT(*) as count,
  SUM(quantity_shipped) as total_quantity
FROM shipments
GROUP BY status;
```

### Active Vehicles

```sql
SELECT * FROM vehicles 
WHERE status = 'Active' 
ORDER BY vehicle_number;
```

---

## Frontend Integration

The React components use the following API functions from `src/utils/inventoryUtils.ts`:

### Inventory Operations
```typescript
await inventoryApi.getAll();
await inventoryApi.getByCategory(category);
await inventoryApi.getByLocation(location);
await inventoryApi.getLowStock();
await inventoryApi.create(item);
await inventoryApi.update(id, updates);
await inventoryApi.delete(id);
```

### Supplier Operations
```typescript
await supplierApi.getAll();
await supplierApi.getByCity(city);
await supplierApi.create(supplier);
await supplierApi.update(id, updates);
await supplierApi.delete(id);
```

### Shipment Operations
```typescript
await shipmentApi.getAll();
await shipmentApi.getPending();
await shipmentApi.getByStatus(status);
await shipmentApi.create(shipment);
await shipmentApi.update(id, updates);
await shipmentApi.delete(id);
```

### Vehicle Operations
```typescript
await vehicleApi.getAll();
await vehicleApi.getActive();
await vehicleApi.create(vehicle);
await vehicleApi.update(id, updates);
await vehicleApi.delete(id);
```

### Report Operations
```typescript
await reportApi.getDailyShipmentReport(date);
await reportApi.getWeeklyShipmentReport();
await reportApi.getMonthlyShipmentReport();
await reportApi.getPendingVsCompleted();
await reportApi.getInventoryStockReport();
```

---

## Features Available

### 1. **Inventory Tab**
- Add/Edit/Delete inventory items
- Track stock quantity and reorder levels
- Items with low stock are highlighted in red
- Categorize items (Solar Panels, Inverters, Cables, etc.)
- Track unit prices and locations

### 2. **Suppliers Tab**
- Manage supplier information
- Track contact details, email, phone
- Manage supplier status (Active/Inactive/Suspended)
- Filter by city
- Rate suppliers

### 3. **Shipments/Deliveries Tab**
- Create and track shipments
- Update shipment status (Pending → Shipped → In Transit → Delivered)
- Link shipments to suppliers and vehicles
- Track quantity shipped and received
- Add tracking numbers and reference numbers

### 4. **Vehicles Tab**
- Manage transport vehicles
- Track vehicle capacity, driver info
- Track vehicle status (Active/Inactive/Under Maintenance)
- Link drivers and contact information

### 5. **Reports Tab**
- **Daily Shipment Report**: Breakdown by status for a specific date
- **Weekly Shipment Report**: Weekly aggregated data
- **Monthly Shipment Report**: Monthly aggregated data
- **Pending vs Completed**: Status-wise shipment count
- **Inventory Stock Report**: Total value by category
- **Download Report**: Export reports as text file

---

## Notes

- All tables use UUID primary keys for better scalability
- Timestamps (created_at, updated_at) are automatically managed
- Status fields have constraints to prevent invalid values
- Indexes are created for frequently queried fields
- Foreign keys link shipments to suppliers
- Row Level Security is enabled (can be configured per user/role)

---

## Troubleshooting

If you encounter errors when creating tables:

1. **"Relation already exists"**: The table already exists. You can drop it with:
   ```sql
   DROP TABLE IF EXISTS inventory CASCADE;
   ```

2. **"Column does not exist"**: Make sure you've created the dependent tables first (e.g., suppliers before shipments)

3. **"Permission denied"**: Make sure you're logged in as a user with appropriate permissions in Supabase

For more help, contact the development team or check the Supabase documentation.
