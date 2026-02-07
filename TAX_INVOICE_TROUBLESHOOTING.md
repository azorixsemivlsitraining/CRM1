# Tax Invoice System - Troubleshooting Guide

## Error: "No tax invoices found"

This is normal if:
- You just created the table and haven't created any invoices yet
- The table is empty

This is a **problem** if:
- You should have invoices but none are showing

**Solution:** Try creating an invoice. If you get an error, see below.

---

## Error: "Failed to save tax invoice"

### Cause 1: Table Not Created
If you see: *"Setup Required - Tax invoices table not found"*

**Fix:**
1. Go to [Connect to Supabase](#open-mcp-popover)
2. Go to **SQL Editor** in your Supabase dashboard
3. Create a new query
4. Copy and paste this SQL:

```sql
CREATE TABLE IF NOT EXISTS public.tax_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  place_of_supply TEXT NOT NULL,
  state TEXT NOT NULL,
  gst_no TEXT NOT NULL UNIQUE,
  items JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_invoices_gst_no ON public.tax_invoices(gst_no);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_customer_name ON public.tax_invoices(customer_name);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_created_at ON public.tax_invoices(created_at);

ALTER TABLE public.tax_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read invoices"
  ON public.tax_invoices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert invoices"
  ON public.tax_invoices FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update invoices"
  ON public.tax_invoices FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete invoices"
  ON public.tax_invoices FOR DELETE
  USING (auth.role() = 'authenticated');
```

5. Click **Run**
6. Refresh your browser and try again

---

### Cause 2: Permission/RLS Issue
If you see: *"Permission Error - You don't have permission"*

**Fix:**
1. Make sure you're logged in with a **Finance or Admin** account
2. Check that `dhanush@axisogreen.in` or the admin account has proper access
3. In Supabase, verify RLS policies are enabled but allow authenticated users
4. Make sure your user is authenticated in the app

---

### Cause 3: Missing Fields
If you see a validation error, make sure you've filled in:
- **Customer Name** ✓
- **State** ✓
- **Place of Supply** ✓
- **At least one Item** ✓

All these fields are required.

---

## Error: "Failed to generate PDF"

### Cause 1: Invalid Invoice Data
Make sure all invoice fields are properly filled:
- Invoice number (auto-generated)
- GST number (auto-generated)
- Invoice date (auto-filled with today's date)
- Items with HSN code, quantity, rate, CGST %, SGST %

### Cause 2: Image Loading Issue
If the logo or stamp image fails to load:
- Check your internet connection
- The images are fetched from an external URL
- This shouldn't block PDF generation (they're optional)

**Solution:** Just try again, images usually load on retry.

---

## Checklist for Complete Setup

- [ ] Supabase table created (`tax_invoices`)
- [ ] RLS policies enabled
- [ ] You're logged in as Finance or Admin user
- [ ] Account email is in the authorized list (e.g., `dhanush@axisogreen.in` or admin)
- [ ] Browser console shows no network errors
- [ ] You can create a test invoice
- [ ] PDF downloads successfully

---

## Common Issues

### "Table already exists" error when running SQL
This is fine! The SQL has `IF NOT EXISTS` which won't recreate it. Just run it anyway.

### Invoice number not auto-incrementing
This is working correctly:
- First invoice: `INV-000001`
- Second invoice: `INV-000002`
- etc.

### GST number not auto-incrementing
Same as above:
- First invoice: `IN-000001`
- Second invoice: `IN-000002`
- etc.

### PDF has no logo/stamp images
This means the images couldn't be fetched. It's not critical - the PDF still works and you can add the images manually later.

---

## How to Check if Supabase is Connected

1. Open your browser's **Developer Console** (F12)
2. Go to **Console** tab
3. Look for any red errors when you try to create an invoice
4. The error message should show exactly what went wrong with Supabase

---

## Still Not Working?

If you've done all the above and it's still not working:

1. **Check Supabase Console:**
   - Go to your Supabase project
   - Click **Table Editor**
   - You should see `tax_invoices` table listed
   - Click it and verify the columns match what we created

2. **Check RLS Policies:**
   - In Supabase, go to **Authentication > Policies**
   - Filter by `tax_invoices` table
   - You should see 4 policies (SELECT, INSERT, UPDATE, DELETE)

3. **Check Browser Logs:**
   - Open DevTools (F12)
   - Try to create an invoice
   - Look at **Network** tab for failed requests
   - Look at **Console** tab for error messages

4. **Reset and Start Fresh:**
   - Delete the `tax_invoices` table from Supabase
   - Run the SQL creation query again
   - Clear your browser cache
   - Log out and log back in
   - Try creating an invoice

---

## Support

If you're still having issues, collect:
- The exact error message from the app
- Browser console logs
- Supabase table structure screenshot
- Your Supabase project name and region

Then contact support with this information.
