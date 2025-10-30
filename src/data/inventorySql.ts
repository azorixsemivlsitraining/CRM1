/**
 * SQL Schemas for Inventory Management System
 * Copy these queries to Supabase SQL Editor and run them to create the tables
 */

export const INVENTORY_SQL_SCHEMAS = `
-- 1. INVENTORY TABLE
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

-- 2. SUPPLIERS/VENDORS TABLE
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

-- 3. SHIPMENTS/DELIVERIES TABLE
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

-- 4. VEHICLES TABLE
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

-- 5. INVENTORY MOVEMENTS/TRANSACTIONS TABLE
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

-- 6. REPORTS/METRICS TABLE (for caching report data)
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

-- Enable RLS (Row Level Security) - Optional but recommended
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_metrics ENABLE ROW LEVEL SECURITY;
`;

export const USEFUL_QUERIES = {
  // Inventory Queries
  getInventoryByCategory: (category: string) => `
    SELECT * FROM inventory 
    WHERE category = '${category}' 
    ORDER BY updated_at DESC;
  `,
  
  getLowStockItems: () => `
    SELECT * FROM inventory 
    WHERE quantity <= reorder_level 
    ORDER BY quantity ASC;
  `,
  
  getInventoryByLocation: (location: string) => `
    SELECT * FROM inventory 
    WHERE location = '${location}' 
    ORDER BY item_name;
  `,
  
  // Supplier Queries
  getActiveSuppliers: () => `
    SELECT * FROM suppliers 
    WHERE status = 'Active' 
    ORDER BY supplier_name;
  `,
  
  getSupplierByCity: (city: string) => `
    SELECT * FROM suppliers 
    WHERE city = '${city}' AND status = 'Active' 
    ORDER BY rating DESC;
  `,
  
  // Shipment Queries
  getPendingShipments: () => `
    SELECT s.*, v.vehicle_number, sup.supplier_name
    FROM shipments s
    LEFT JOIN vehicles v ON s.vehicle_id = v.id
    LEFT JOIN suppliers sup ON s.supplier_id = sup.id
    WHERE s.status IN ('Pending', 'Shipped', 'In Transit')
    ORDER BY s.shipment_date DESC;
  `,
  
  getDailyShipmentReport: (date: string) => `
    SELECT 
      DATE(shipment_date) as date,
      status,
      COUNT(*) as count,
      SUM(quantity_shipped) as total_quantity
    FROM shipments
    WHERE DATE(shipment_date) = '${date}'
    GROUP BY DATE(shipment_date), status;
  `,
  
  getWeeklyShipmentReport: () => `
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
  `,
  
  getMonthlyShipmentReport: () => `
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
  `,
  
  getPendingVsCompletedShipments: () => `
    SELECT 
      status,
      COUNT(*) as count,
      SUM(quantity_shipped) as total_quantity
    FROM shipments
    GROUP BY status;
  `,
  
  // Inventory Stock Report
  getInventoryStockReport: () => `
    SELECT 
      category,
      COUNT(*) as item_count,
      SUM(quantity) as total_quantity,
      AVG(unit_price) as avg_unit_price,
      SUM(quantity * unit_price) as total_value
    FROM inventory
    GROUP BY category
    ORDER BY total_value DESC;
  `,
  
  // Vehicle Queries
  getActiveVehicles: () => `
    SELECT * FROM vehicles 
    WHERE status = 'Active' 
    ORDER BY vehicle_number;
  `,
  
  // Inventory Movement History
  getMovementHistory: (itemId: string) => `
    SELECT * FROM inventory_movements 
    WHERE item_id = '${itemId}' 
    ORDER BY movement_date DESC;
  `,
};

export const QUERY_EXAMPLES = {
  exampleInsertInventory: `
    INSERT INTO inventory (item_code, item_name, category, quantity, reorder_level, location, unit_price, created_by)
    VALUES ('SOL-001', 'Solar Panel 400W', 'Solar Panels', 50, 20, 'Hyderabad', 15000.00, 'admin')
    RETURNING *;
  `,
  
  exampleInsertSupplier: `
    INSERT INTO suppliers (supplier_code, supplier_name, contact_person, email, phone, city, status, created_by)
    VALUES ('SUP-001', 'Green Solar Inc', 'John Doe', 'john@greensolar.com', '+919876543210', 'Mumbai', 'Active', 'admin')
    RETURNING *;
  `,
  
  exampleInsertShipment: `
    INSERT INTO shipments (shipment_no, shipment_date, origin_location, destination_location, supplier_id, status, created_by)
    VALUES ('SHIP-001', '2024-01-15', 'Mumbai', 'Hyderabad', 'UUID_OF_SUPPLIER', 'Pending', 'admin')
    RETURNING *;
  `,
  
  exampleInsertVehicle: `
    INSERT INTO vehicles (vehicle_code, vehicle_number, vehicle_type, capacity_tons, driver_name, status, created_by)
    VALUES ('VEH-001', 'TS-01-AB-1234', 'Truck', 5.0, 'Raj Kumar', 'Active', 'admin')
    RETURNING *;
  `,
  
  exampleUpdateInventoryQuantity: `
    UPDATE inventory 
    SET quantity = quantity + 10, updated_at = NOW()
    WHERE item_code = 'SOL-001'
    RETURNING *;
  `,
  
  exampleShipmentStatusUpdate: `
    UPDATE shipments 
    SET status = 'Delivered', actual_delivery = NOW(), updated_at = NOW()
    WHERE shipment_no = 'SHIP-001'
    RETURNING *;
  `,
};
