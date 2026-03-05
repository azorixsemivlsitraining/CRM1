# Sales Module - Supabase Setup

Run the following SQL queries in your Supabase SQL Editor to set up the Sales module tables.

## 1. Create Sales Persons Table

```sql
CREATE TABLE sales_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 2. Create Lead Sources Table

```sql
CREATE TABLE lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default sources
INSERT INTO lead_sources (name, icon, color) VALUES
('WhatsApp', '💬', '#25D366'),
('Facebook', '📘', '#1877F2'),
('Social Media', '📱', '#6C63FF'),
('Website', '🌐', '#FF6B6B'),
('Referral', '👥', '#FFB627'),
('Phone Call', '📞', '#4CAF50'),
('Email', '✉️', '#EA4335'),
('Walk-in', '🚶', '#9C27B0');
```

## 3. Create Leads Table

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  location TEXT,
  source_id UUID REFERENCES lead_sources(id),
  assigned_to UUID REFERENCES sales_persons(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_source_id ON leads(source_id);
```

## 4. Create Pipeline Stages Table

```sql
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  order_index INT NOT NULL,
  color TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default stages
INSERT INTO pipeline_stages (name, order_index, color) VALUES
('Lead', 1, '#E3F2FD'),
('Call', 2, '#FFF3E0'),
('Response', 3, '#FCE4EC'),
('Location Details', 4, '#F3E5F5'),
('Site Visit', 5, '#E0F2F1'),
('Advance Payment', 6, '#C8E6C9'),
('Qualified', 7, '#A5D6A7');
```

## 5. Create Lead Pipeline Table

```sql
CREATE TABLE lead_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  current_stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  call_notes TEXT,
  call_response TEXT,
  location_details TEXT,
  site_visit_date DATE,
  site_visit_notes TEXT,
  advance_payment_amount DECIMAL(10, 2),
  advance_payment_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lead_pipeline_lead_id ON lead_pipeline(lead_id);
CREATE INDEX idx_lead_pipeline_current_stage_id ON lead_pipeline(current_stage_id);
```

## 6. Create Lead Activity Table (for tracking changes)

```sql
CREATE TABLE lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES sales_persons(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
```

## 7. Set up Row Level Security (Optional but Recommended)

```sql
-- Enable RLS
ALTER TABLE sales_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_pipeline ENABLE ROW LEVEL SECURITY;

-- Sales persons can view themselves and others
CREATE POLICY "Allow all to view sales persons"
  ON sales_persons FOR SELECT
  USING (true);

-- Users can view leads (we can make this more granular later)
CREATE POLICY "Allow all to view leads"
  ON leads FOR SELECT
  USING (true);

-- Users can view their own lead pipeline
CREATE POLICY "Allow viewing lead pipeline"
  ON lead_pipeline FOR SELECT
  USING (true);
```
