import { supabase } from '../lib/supabase';

export interface InventoryItem {
  id: string;
  item_code: string;
  item_name: string;
  category: string;
  quantity: number;
  reorder_level: number;
  location?: string;
  supplier_id?: string;
  unit_price?: number;
  cost_price?: number;
  description?: string;
  notes?: string;
  updated_at?: string;
  created_at?: string;
}

export interface Supplier {
  id: string;
  supplier_code: string;
  supplier_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  status: string;
  rating?: number;
  notes?: string;
  updated_at?: string;
}

export interface Shipment {
  id: string;
  shipment_no: string;
  shipment_date: string;
  origin_location?: string;
  destination_location?: string;
  supplier_id?: string;
  vehicle_id?: string;
  status: string;
  tracking_number?: string;
  expected_delivery?: string;
  actual_delivery?: string;
  quantity_shipped?: number;
  quantity_received?: number;
  reference_number?: string;
  notes?: string;
  updated_at?: string;
}

export interface Vehicle {
  id: string;
  vehicle_code: string;
  vehicle_number: string;
  vehicle_type?: string;
  capacity_tons?: number;
  driver_name?: string;
  driver_phone?: string;
  status: string;
  notes?: string;
  updated_at?: string;
}

// INVENTORY OPERATIONS
export const inventoryApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data as InventoryItem[];
  },

  async getByCategory(category: string) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('category', category)
      .order('item_name', { ascending: true });
    if (error) throw error;
    return data as InventoryItem[];
  },

  async getByLocation(location: string) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('location', location)
      .order('item_name', { ascending: true });
    if (error) throw error;
    return data as InventoryItem[];
  },

  async getLowStock() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .lte('quantity', supabase.rpc('get_reorder_level'))
      .order('quantity', { ascending: true });
    if (error) throw error;
    return data as InventoryItem[];
  },

  async create(item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('inventory')
      .insert([item])
      .select('*');
    if (error) throw error;
    return data?.[0] as InventoryItem;
  },

  async update(id: string, updates: Partial<InventoryItem>) {
    const { data, error } = await supabase
      .from('inventory')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*');
    if (error) throw error;
    return data?.[0] as InventoryItem;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async updateQuantity(id: string, quantity: number) {
    return this.update(id, { quantity });
  },
};

// SUPPLIER OPERATIONS
export const supplierApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('status', 'Active')
      .order('supplier_name', { ascending: true });
    if (error) throw error;
    return data as Supplier[];
  },

  async getByCity(city: string) {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('city', city)
      .eq('status', 'Active')
      .order('rating', { ascending: false });
    if (error) throw error;
    return data as Supplier[];
  },

  async getAllSuppliers() {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('supplier_name', { ascending: true });
    if (error) throw error;
    return data as Supplier[];
  },

  async create(supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplier])
      .select('*');
    if (error) throw error;
    return data?.[0] as Supplier;
  },

  async update(id: string, updates: Partial<Supplier>) {
    const { data, error } = await supabase
      .from('suppliers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*');
    if (error) throw error;
    return data?.[0] as Supplier;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// SHIPMENT OPERATIONS
export const shipmentApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('shipments')
      .select('*, vehicles(vehicle_number), suppliers(supplier_name)')
      .order('shipment_date', { ascending: false });
    if (error) throw error;
    return data as any[];
  },

  async getPending() {
    const { data, error } = await supabase
      .from('shipments')
      .select('*, vehicles(vehicle_number), suppliers(supplier_name)')
      .in('status', ['Pending', 'Shipped', 'In Transit'])
      .order('shipment_date', { ascending: false });
    if (error) throw error;
    return data as any[];
  },

  async getByStatus(status: string) {
    const { data, error } = await supabase
      .from('shipments')
      .select('*, vehicles(vehicle_number), suppliers(supplier_name)')
      .eq('status', status)
      .order('shipment_date', { ascending: false });
    if (error) throw error;
    return data as any[];
  },

  async create(shipment: Omit<Shipment, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('shipments')
      .insert([shipment])
      .select('*');
    if (error) throw error;
    return data?.[0] as Shipment;
  },

  async update(id: string, updates: Partial<Shipment>) {
    const { data, error } = await supabase
      .from('shipments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*');
    if (error) throw error;
    return data?.[0] as Shipment;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('shipments')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// VEHICLE OPERATIONS
export const vehicleApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('vehicle_number', { ascending: true });
    if (error) throw error;
    return data as Vehicle[];
  },

  async getActive() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'Active')
      .order('vehicle_number', { ascending: true });
    if (error) throw error;
    return data as Vehicle[];
  },

  async create(vehicle: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('vehicles')
      .insert([vehicle])
      .select('*');
    if (error) throw error;
    return data?.[0] as Vehicle;
  },

  async update(id: string, updates: Partial<Vehicle>) {
    const { data, error } = await supabase
      .from('vehicles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*');
    if (error) throw error;
    return data?.[0] as Vehicle;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// REPORT OPERATIONS
export const reportApi = {
  async getDailyShipmentReport(date: string) {
    const { data, error } = await supabase
      .from('shipments')
      .select('status, quantity_shipped, quantity_received')
      .eq('shipment_date', date);
    if (error) throw error;
    
    const summary = (data || []).reduce((acc: any, shipment: any) => {
      const status = shipment.status || 'Unknown';
      if (!acc[status]) {
        acc[status] = { count: 0, shipped: 0, received: 0 };
      }
      acc[status].count += 1;
      acc[status].shipped += shipment.quantity_shipped || 0;
      acc[status].received += shipment.quantity_received || 0;
      return acc;
    }, {});

    return summary;
  },

  async getWeeklyShipmentReport() {
    const { data, error } = await supabase
      .from('shipments')
      .select('shipment_date, status, quantity_shipped, quantity_received')
      .gte('shipment_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order('shipment_date', { ascending: false });
    if (error) throw error;

    const summary = (data || []).reduce((acc: any, shipment: any) => {
      const week = new Date(shipment.shipment_date).toLocaleDateString('en-US', { week: 'long' });
      if (!acc[week]) {
        acc[week] = { count: 0, shipped: 0, received: 0 };
      }
      acc[week].count += 1;
      acc[week].shipped += shipment.quantity_shipped || 0;
      acc[week].received += shipment.quantity_received || 0;
      return acc;
    }, {});

    return summary;
  },

  async getMonthlyShipmentReport() {
    const { data, error } = await supabase
      .from('shipments')
      .select('shipment_date, status, quantity_shipped, quantity_received')
      .gte('shipment_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order('shipment_date', { ascending: false });
    if (error) throw error;

    const summary = (data || []).reduce((acc: any, shipment: any) => {
      const month = new Date(shipment.shipment_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!acc[month]) {
        acc[month] = { count: 0, shipped: 0, received: 0 };
      }
      acc[month].count += 1;
      acc[month].shipped += shipment.quantity_shipped || 0;
      acc[month].received += shipment.quantity_received || 0;
      return acc;
    }, {});

    return summary;
  },

  async getPendingVsCompleted() {
    const { data, error } = await supabase
      .from('shipments')
      .select('status, quantity_shipped, quantity_received');
    if (error) throw error;

    const summary = (data || []).reduce((acc: any, shipment: any) => {
      const status = shipment.status || 'Unknown';
      if (!acc[status]) {
        acc[status] = { count: 0, shipped: 0, received: 0 };
      }
      acc[status].count += 1;
      acc[status].shipped += shipment.quantity_shipped || 0;
      acc[status].received += shipment.quantity_received || 0;
      return acc;
    }, {});

    return summary;
  },

  async getInventoryStockReport() {
    const { data, error } = await supabase
      .from('inventory')
      .select('category, quantity, unit_price');
    if (error) throw error;

    const summary = (data || []).reduce((acc: any, item: any) => {
      const category = item.category || 'Other';
      if (!acc[category]) {
        acc[category] = { count: 0, totalQty: 0, totalValue: 0 };
      }
      acc[category].count += 1;
      acc[category].totalQty += item.quantity || 0;
      acc[category].totalValue += (item.quantity || 0) * (item.unit_price || 0);
      return acc;
    }, {});

    return summary;
  },
};
