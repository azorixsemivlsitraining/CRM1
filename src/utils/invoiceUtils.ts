import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';

export interface InvoiceItem {
  id: string;
  hsn_code: string;
  quantity: number;
  rate: number;
  cgst_rate: number;
  sgst_rate: number;
}

export interface TaxInvoiceData {
  id?: string;
  gst_number: string;
  invoice_number: string;
  invoice_date: string;
  bill_to_name: string;
  bill_to_address: string;
  bill_to_gst: string;
  ship_to_name: string;
  ship_to_address: string;
  place_of_supply: string;
  items: InvoiceItem[];
  notes: string;
  terms_and_conditions: string;
  created_at?: string;
  updated_at?: string;
}

export async function getNextGSTNumber(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('tax_invoices')
      .select('gst_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const lastGst = data[0].gst_number;
      const num = parseInt(lastGst.replace('IN-', ''), 10);
      const nextNum = (num + 1).toString().padStart(6, '0');
      return `IN-${nextNum}`;
    }

    return 'IN-000001';
  } catch (err) {
    console.error('Error getting next GST number:', err);
    return `IN-${Date.now().toString().slice(-6)}`;
  }
}

export async function getNextInvoiceNumber(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('tax_invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const lastInv = data[0].invoice_number;
      const num = parseInt(lastInv.replace('INV-', ''), 10);
      const nextNum = (num + 1).toString().padStart(6, '0');
      return `INV-${nextNum}`;
    }

    return 'INV-000001';
  } catch (err) {
    console.error('Error getting next invoice number:', err);
    return `INV-${Date.now().toString().slice(-6)}`;
  }
}

export function calculateInvoiceTotals(items: InvoiceItem[]): {
  totalQty: number;
  totalRate: number;
  totalCgst: number;
  totalSgst: number;
  totalAmount: number;
} {
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalRate = items.reduce((sum, item) => sum + item.rate * item.quantity, 0);
  const totalCgst = items.reduce((sum, item) => sum + (item.rate * item.quantity * item.cgst_rate) / 100, 0);
  const totalSgst = items.reduce((sum, item) => sum + (item.rate * item.quantity * item.sgst_rate) / 100, 0);
  const totalAmount = totalRate + totalCgst + totalSgst;

  return {
    totalQty,
    totalRate,
    totalCgst,
    totalSgst,
    totalAmount,
  };
}

export function convertNumberToWords(num: number): string {
  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const formatTens = (value: number): string => {
    if (value < 10) return single[value];
    if (value < 20) return double[value - 10];
    return tens[Math.floor(value / 10)] + (value % 10 !== 0 ? ` ${single[value % 10]}` : '');
  };

  if (num === 0) return 'Zero';
  let workingValue = num;
  let words = '';

  if (workingValue >= 10000000) {
    words += `${convertNumberToWords(Math.floor(workingValue / 10000000))} Crore `;
    workingValue %= 10000000;
  }
  if (workingValue >= 100000) {
    words += `${convertNumberToWords(Math.floor(workingValue / 100000))} Lakh `;
    workingValue %= 100000;
  }
  if (workingValue >= 1000) {
    words += `${convertNumberToWords(Math.floor(workingValue / 1000))} Thousand `;
    workingValue %= 1000;
  }
  if (workingValue >= 100) {
    words += `${convertNumberToWords(Math.floor(workingValue / 100))} Hundred `;
    workingValue %= 100;
  }
  if (workingValue > 0) {
    words += formatTens(workingValue);
  }

  return words.trim();
}

export async function fetchImageAsDataURL(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Error fetching image:', err);
    return '';
  }
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
