# Tax Invoice System - Setup Guide

## Overview
The Tax Invoice system has been created with the following features:
- Auto-incrementing GST numbers (IN-000001, IN-000002, etc.)
- Auto-incrementing invoice numbers (INV-000001, INV-000002, etc.)
- Automatic invoice date (defaults to today)
- PDF generation with exact format matching the provided image
- Full CRUD operations (Create, Read, Update, Delete)
- Logo and signature stamp embedded in PDFs

## Database Setup

You need to create a `tax_invoices` table in your Supabase database. Use the SQL below:

```sql
-- Create tax_invoices table
CREATE TABLE IF NOT EXISTS public.tax_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gst_number VARCHAR(20) NOT NULL UNIQUE,
  invoice_number VARCHAR(20) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  bill_to_name VARCHAR(255) NOT NULL,
  bill_to_address TEXT,
  bill_to_gst VARCHAR(20),
  ship_to_name VARCHAR(255) NOT NULL,
  ship_to_address TEXT,
  place_of_supply VARCHAR(100),
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  terms_and_conditions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_tax_invoices_gst_number ON public.tax_invoices(gst_number);
CREATE INDEX idx_tax_invoices_invoice_number ON public.tax_invoices(invoice_number);
CREATE INDEX idx_tax_invoices_created_at ON public.tax_invoices(created_at);

-- Enable RLS (Row Level Security) if needed
ALTER TABLE public.tax_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (optional)
CREATE POLICY "Allow authenticated users to read invoices"
  ON public.tax_invoices
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert invoices"
  ON public.tax_invoices
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update invoices"
  ON public.tax_invoices
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete invoices"
  ON public.tax_invoices
  FOR DELETE
  USING (auth.role() = 'authenticated');
```

## Steps to Set Up

1. **Connect to Supabase** via [Open MCP popover](#open-mcp-popover)
   - Select Supabase from the list of MCP servers
   - Connect to your Supabase project

2. **Create the table**
   - Go to your Supabase project dashboard
   - Click "SQL Editor"
   - Create a new query
   - Copy and paste the SQL from above
   - Click "Run"

3. **Access the Tax Invoice page**
   - Navigate to `/tax-invoices` in your application
   - You will see the Tax Invoices management page

## Features

### Creating an Invoice
1. Click "Create Invoice" button
2. Fill in the following information:
   - **Invoice Date**: Defaults to today
   - **Place of Supply**: Select from dropdown (Telangana, Andhra Pradesh, Karnataka, Tamil Nadu)
   - **Bill To**: Customer name, address, and GST number
   - **Ship To**: Shipping address
   - **Items**: Add items with:
     - HSN Code (defaults to 708541 - renewable energy devices)
     - Quantity
     - Rate
     - CGST % (typically 9%)
     - SGST % (typically 9%)
3. Add notes and terms & conditions
4. Click "Save Invoice"

### Important Notes
- GST numbers are auto-incremented starting from IN-000001
- Invoice numbers are auto-incremented starting from INV-000001
- The system combines all items into a single table row in the PDF
- Logo and signature stamp are automatically embedded in the PDF
- All calculations (CGST, SGST, totals) are automatic

### PDF Format
The PDF includes:
- Company logo (top-left)
- Company details and contact information
- "TAX INVOICE" title
- Invoice number, GST number, date, and place of supply
- Bill To and Ship To sections
- Single-row items table with:
  - Item description (combined from all items)
  - HSN codes
  - Total quantity
  - Total rate
  - CGST with % and amount
  - SGST with % and amount
  - Total amount
- Sub-total and tax summary
- Amount in words
- Notes section
- Terms and conditions
- Signature stamp area (with automatic stamp image)
- Footer with company GSTIN and contact details

## Editing and Deleting Invoices

### Edit
1. Find the invoice in the list
2. Click the Edit icon (pencil)
3. Modify the information
4. Click "Save Invoice"

### Delete
1. Find the invoice in the list
2. Click the Delete icon (trash)
3. Confirm the deletion
4. Invoice will be permanently removed

### Download PDF
1. Find the invoice in the list
2. Click the Download icon (arrow)
3. PDF will be generated and downloaded with the exact format

## Troubleshooting

### Table Not Found Error
- Make sure you've created the `tax_invoices` table in Supabase
- Run the SQL provided in the Database Setup section

### Images Not Loading in PDF
- The logo and stamp URLs are hardcoded in the system
- Make sure you have internet access for fetching these images
- Check that the image URLs are accessible

### GST Number Not Auto-Incrementing
- This is normal if it's your first invoice (it will start at IN-000001)
- The system reads the last GST number and increments it by 1

### Permission Denied Error
- Make sure you're logged in with a Finance or Admin account
- The Tax Invoice page is restricted to finance and admin users
- Check your user permissions in the project_assignments table

## Company Information

Default company information configured in the system:
- **Name**: Axiso Green Energies Private Limited
- **Address**: Plot No-102,103, Temple Lane Mythri Nagar, Shri Ambika Vidya Mandir, Mathrusrinagar, Serlingampally, Hyderabad, Rangareddy, Telangana 500049
- **GSTIN**: 36ABBCA4478M1Z9
- **Email**: admin@axisogreen.in
- **Website**: www.axisogreen.in

## Images

The following images are embedded in the system:
1. **Logo**: Used in the top-left of the invoice
2. **Signature Stamp**: Used in the bottom-right of the invoice

Both images are stored as URLs and fetched dynamically when generating PDFs.

## Next Steps

After setting up the database:
1. Log in with a Finance or Admin account
2. Navigate to `/tax-invoices`
3. Click "Create Invoice" to create your first invoice
4. Download the PDF to verify the format matches your requirements
5. Edit or delete invoices as needed

---

If you encounter any issues or need to customize the invoice format further, please let me know!
