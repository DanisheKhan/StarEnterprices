import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fqmdgkdohktiqvytblbx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbWRna2RvaGt0aXF2eXRibGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDczMDksImV4cCI6MjEwNzYyMzMwOX0.Qn-AvWwkk5WtAlYGCANCn9-5vm80OTb41tKMz7bOH98';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORE_ID = null; // Enterprise wide - visible across all stores (Furniture & Electronics, Mobiles, etc.)

async function seed() {
  console.log('1. Cleaning existing dealer records...');
  const { error: e1 } = await supabase.from('dealer_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e1) console.error('Error deleting payments:', e1);
  const { error: e2 } = await supabase.from('dealer_debit_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e2) console.error('Error deleting debit notes:', e2);
  const { error: e3 } = await supabase.from('dealer_bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e3) console.error('Error deleting bills:', e3);
  const { error: e4 } = await supabase.from('dealers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e4) console.error('Error deleting dealers:', e4);

  console.log('2. Inserting realistic dealers...');
  const dealers = [
    {
      id: 'f9905e74-2c0f-4d1e-a4e4-ca9bbbbbe3da',
      store_id: STORE_ID,
      name: 'Samsung India Electronics Pvt Ltd',
      trade_name: 'Samsung India Electronics',
      brand_name: 'Samsung India',
      contact_person: 'Rajesh Singhania (Regional Sales Mgr)',
      phone: '9811223344',
      alternate_phone: '01204899100',
      email: 'b2b.north@samsung.com',
      address: 'Plot 3, Sector 62, Institutional Area',
      city: 'Noida',
      state_code: '09',
      gstin: '09AABCS1429B1Z1',
      pan_number: 'AABCS1429B',
      bank_name: 'HDFC Bank',
      account_number: '50200012345678',
      ifsc_code: 'HDFC0000128',
      upi_id: 'samsung.b2b@hdfcbank',
      dealer_type: 'brand_direct',
      billing_mode: 'gst',
      default_credit_days: 30,
      opening_balance: 0,
      notes: 'Primary consumer electronics & home appliances distributor. Supplies Smart TVs, Refrigerators, and ACs.',
      is_active: true
    },
    {
      id: 'fbbf0bfa-69ac-4445-b5fe-35612ee7a0a3',
      store_id: STORE_ID,
      name: 'Godrej & Boyce Mfg. Co. Ltd',
      trade_name: 'Godrej Interio Division',
      brand_name: 'Godrej Interio',
      contact_person: 'Virendra Sharma (Key Account Exec)',
      phone: '9876543210',
      alternate_phone: '02267961100',
      email: 'interio.up@godrej.com',
      address: 'Godrej Regional Depot, Transport Nagar',
      city: 'Kanpur',
      state_code: '09',
      gstin: '09AAACG1234F1Z5',
      pan_number: 'AAACG1234F',
      bank_name: 'State Bank of India',
      account_number: '38291048192',
      ifsc_code: 'SBIN0001428',
      upi_id: 'godrej.interio@sbi',
      dealer_type: 'brand_direct',
      billing_mode: 'gst',
      default_credit_days: 30,
      opening_balance: 0,
      notes: 'Official Godrej factory direct supply for steel almirahs, wardrobes, and modular office furniture.',
      is_active: true
    },
    {
      id: '1bb5d38c-f751-4bb7-94ee-e6c44ea19da2',
      store_id: STORE_ID,
      name: 'Sheela Foam Ltd (Sleepwell)',
      trade_name: 'Sleepwell Distributorship',
      brand_name: 'Sleepwell Mattresses',
      contact_person: 'Amit Agarwal',
      phone: '9839011223',
      alternate_phone: '9415011223',
      email: 'orders.sleepwell@sheelafoam.com',
      address: 'Plot 14, Trans-Ganga Industrial Area',
      city: 'Unnao',
      state_code: '09',
      gstin: '09AAACS9988K1Z3',
      pan_number: 'AAACS9988K',
      bank_name: 'Punjab National Bank',
      account_number: '01920021000341',
      ifsc_code: 'PUNB0019200',
      upi_id: 'sleepwell.dist@pnb',
      dealer_type: 'authorized_distributor',
      billing_mode: 'both',
      default_credit_days: 21,
      opening_balance: 0,
      notes: 'Authorized regional distributor for Sleepwell Ortho Pro & Dual Comfort bonded foam mattresses.',
      is_active: true
    },
    {
      id: 'c3b77241-e970-4f59-9943-41bbd5641772',
      store_id: STORE_ID,
      name: 'MIRC Electronics Ltd (Onida)',
      trade_name: 'Onida Northern Depot',
      brand_name: 'Onida',
      contact_person: 'Sunil Chawla',
      phone: '9822334455',
      alternate_phone: null,
      email: 'onida.north@mirc.com',
      address: 'Onida Logistics Hub, Okhla Phase III',
      city: 'New Delhi',
      state_code: '07',
      gstin: '09AAACM2233P1Z9',
      pan_number: 'AAACM2233P',
      bank_name: 'ICICI Bank',
      account_number: '004505012390',
      ifsc_code: 'ICIC0000045',
      upi_id: 'onida.depot@icici',
      dealer_type: 'brand_direct',
      billing_mode: 'gst',
      default_credit_days: 30,
      opening_balance: 0,
      notes: 'Direct supply for Onida split air conditioners and washing machines.',
      is_active: true
    },
    {
      id: 'd8e62241-1120-4a89-9132-72ccfa659114',
      store_id: STORE_ID,
      name: 'Noor Wooden Art & Sofa Workshop',
      trade_name: 'Noor Wood Works',
      brand_name: 'Noor Workshop (Kaccha / Mandi)',
      contact_person: 'Ustad Noor Mohammad',
      phone: '9415099882',
      alternate_phone: '9336122334',
      email: null,
      address: 'Timber Market, Near Chungi, Old Saharanpur Road',
      city: 'Local Mandi',
      state_code: '09',
      gstin: null,
      pan_number: null,
      bank_name: null,
      account_number: null,
      ifsc_code: null,
      upi_id: 'noor.woodworks@upi',
      dealer_type: 'local_wholesaler',
      billing_mode: 'kaccha',
      default_credit_days: 15,
      opening_balance: 0,
      notes: 'Local artisan workshop manufacturing handcrafted teakwood and sheesham 7-seater sofa sets and carved dining frames. Secondary cash ledger / parchi.',
      is_active: true
    }
  ];

  const { error: insDealersErr } = await supabase.from('dealers').insert(dealers);
  if (insDealersErr) {
    console.error('Error inserting dealers:', insDealersErr);
    return;
  }
  console.log('Dealers inserted successfully!');

  console.log('3. Inserting realistic dealer bills...');
  const bills = [
    {
      id: 'a1111111-1111-1111-1111-111111111111',
      store_id: STORE_ID,
      dealer_id: 'f9905e74-2c0f-4d1e-a4e4-ca9bbbbbe3da',
      bill_type: 'gst',
      bill_number: 'INV-SAM-2026-9041',
      bill_date: '2026-11-10',
      credit_days: 30,
      due_date: '2026-12-10',
      taxable_amount: 207627.12,
      cgst_amount: 18686.44,
      sgst_amount: 18686.44,
      igst_amount: 0,
      total_tax_amount: 37372.88,
      total_amount: 245000.00,
      notes: 'Festival electronics consignment: 5x 55-inch UHD Smart TVs and 3x Double Door Inverter Refrigerators. Paid ₹50,000 cash on truck arrival, issued ₹75,000 cheque #401901. Balance ₹1,20,000 due 10 Dec 2026.',
      items: [
        { name: 'Samsung 55" Crystal 4K UHD Smart TV (55CU7700)', quantity: 5, unit_price: 32000, total: 160000 },
        { name: 'Samsung 253L Frost-Free Double Door Refrigerator', quantity: 3, unit_price: 28333.33, total: 85000 }
      ]
    },
    {
      id: 'b2222222-2222-2222-2222-222222222222',
      store_id: STORE_ID,
      dealer_id: 'fbbf0bfa-69ac-4445-b5fe-35612ee7a0a3',
      bill_type: 'gst',
      bill_number: 'GDJ-INV-4412',
      bill_date: '2026-10-25',
      credit_days: 30,
      due_date: '2026-11-24',
      taxable_amount: 152542.37,
      cgst_amount: 13728.81,
      sgst_amount: 13728.81,
      igst_amount: 0,
      total_tax_amount: 27457.63,
      total_amount: 180000.00,
      notes: 'Delivered directly to showroom floor. Cleared in 2 installments via SBI Cheques #102941 and #102942.',
      items: [
        { name: 'Godrej Slimline 3-Door Steel Almirah (Classic Walnut)', quantity: 6, unit_price: 18000, total: 108000 },
        { name: 'Godrej Motion Ergonomic High-Back Office Chairs', quantity: 12, unit_price: 6000, total: 72000 }
      ]
    },
    {
      id: 'b3333333-3333-3333-3333-333333333333',
      store_id: STORE_ID,
      dealer_id: 'fbbf0bfa-69ac-4445-b5fe-35612ee7a0a3',
      bill_type: 'gst',
      bill_number: 'GDJ-INV-5120',
      bill_date: '2026-11-18',
      credit_days: 30,
      due_date: '2026-12-18',
      taxable_amount: 114406.78,
      cgst_amount: 10296.61,
      sgst_amount: 10296.61,
      igst_amount: 0,
      total_tax_amount: 20593.22,
      total_amount: 135000.00,
      notes: 'Dining sets & display bookshelves. Issued post-dated cheque (PDC) of ₹50,000 for 05 Dec 2026. Remaining ₹85,000 due 18 Dec 2026.',
      items: [
        { name: 'Godrej 6-Seater Solid Sheesham Dining Table + Chairs', quantity: 3, unit_price: 35000, total: 105000 },
        { name: 'Godrej Premium Metal Bookshelf & Display Units', quantity: 2, unit_price: 15000, total: 30000 }
      ]
    },
    {
      id: 'c4444444-4444-4444-4444-444444444444',
      store_id: STORE_ID,
      dealer_id: '1bb5d38c-f751-4bb7-94ee-e6c44ea19da2',
      bill_type: 'gst',
      bill_number: 'SLP/2026/882',
      bill_date: '2026-11-04',
      credit_days: 21,
      due_date: '2026-11-25',
      taxable_amount: 80508.47,
      cgst_amount: 7245.76,
      sgst_amount: 7245.76,
      igst_amount: 0,
      total_tax_amount: 14491.53,
      total_amount: 95000.00,
      notes: 'Bonded foam ortho mattresses. Paid ₹35,000 UPI advance, ₹35,000 Cheque #772810. Final balance of ₹25,000 due in 4 days (25 Nov).',
      items: [
        { name: 'Sleepwell Ortho Pro 6-inch Queen Foam Mattress', quantity: 10, unit_price: 6500, total: 65000 },
        { name: 'Sleepwell Dual Comfort 8-inch King Pocket Spring', quantity: 5, unit_price: 6000, total: 30000 }
      ]
    },
    {
      id: 'd5555555-5555-5555-5555-555555555555',
      store_id: STORE_ID,
      dealer_id: 'c3b77241-e970-4f59-9943-41bbd5641772',
      bill_type: 'gst',
      bill_number: 'ONI-INV-7104',
      bill_date: '2026-10-12',
      credit_days: 30,
      due_date: '2026-11-11',
      taxable_amount: 63559.32,
      cgst_amount: 5720.34,
      sgst_amount: 5720.34,
      igst_amount: 0,
      total_tax_amount: 11440.68,
      total_amount: 75000.00,
      notes: 'Pre-winter AC stock intake. Paid ₹30,000 Cheque #509211 on 20 Oct. Balance ₹45,000 is 9 days overdue! Dealer representative called for payment.',
      items: [
        { name: 'Onida 1.5 Ton 3-Star Inverter Split AC (Copper)', quantity: 3, unit_price: 25000, total: 75000 }
      ]
    },
    {
      id: 'e6666666-6666-6666-6666-666666666666',
      store_id: STORE_ID,
      dealer_id: 'd8e62241-1120-4a89-9132-72ccfa659114',
      bill_type: 'kaccha',
      bill_number: 'Parchi #042',
      bill_date: '2026-11-14',
      credit_days: 15,
      due_date: '2026-11-29',
      taxable_amount: 68000.00,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_tax_amount: 0,
      total_amount: 68000.00,
      notes: 'Handmade Teakwood 7-seater sofa frames delivered by tempo. Paid ₹20,000 cash to tempo driver on unloading. Balance ₹48,000 cash promised by 29 Nov.',
      items: [
        { name: 'Handmade Teakwood 7-Seater Sofa Frame + Cushion Base', quantity: 2, unit_price: 24000, total: 48000 },
        { name: 'Carved Sheesham Center & Side Coffee Tables', quantity: 4, unit_price: 5000, total: 20000 }
      ]
    }
  ];

  const { error: insBillsErr } = await supabase.from('dealer_bills').insert(bills);
  if (insBillsErr) {
    console.error('Error inserting bills:', insBillsErr);
    return;
  }
  console.log('Bills inserted successfully!');

  console.log('4. Inserting payments & cheques...');
  const payments = [
    // Samsung Payments
    {
      dealer_id: 'f9905e74-2c0f-4d1e-a4e4-ca9bbbbbe3da',
      bill_id: 'a1111111-1111-1111-1111-111111111111',
      store_id: STORE_ID,
      payment_number: 'PAY-SAM-001',
      payment_date: '2026-11-10',
      amount: 50000.00,
      payment_mode: 'cash',
      payment_channel: 'official_bank',
      transaction_ref: null,
      cheque_date: null,
      notes: 'Advance cash paid on goods receipt at showroom'
    },
    {
      dealer_id: 'f9905e74-2c0f-4d1e-a4e4-ca9bbbbbe3da',
      bill_id: 'a1111111-1111-1111-1111-111111111111',
      store_id: STORE_ID,
      payment_number: 'PAY-SAM-002',
      payment_date: '2026-11-18',
      amount: 75000.00,
      payment_mode: 'cheque',
      payment_channel: 'official_bank',
      transaction_ref: '401901',
      cheque_date: '2026-11-18',
      notes: 'Cheque #401901 (HDFC Bank) cleared against INV-SAM-2026-9041'
    },
    // Godrej Bill 1 Payments (Fully Cleared)
    {
      dealer_id: 'fbbf0bfa-69ac-4445-b5fe-35612ee7a0a3',
      bill_id: 'b2222222-2222-2222-2222-222222222222',
      store_id: STORE_ID,
      payment_number: 'PAY-GDJ-001',
      payment_date: '2026-10-25',
      amount: 90000.00,
      payment_mode: 'cheque',
      payment_channel: 'official_bank',
      transaction_ref: '102941',
      cheque_date: '2026-10-25',
      notes: '1st Cheque #102941 (SBI) on delivery'
    },
    {
      dealer_id: 'fbbf0bfa-69ac-4445-b5fe-35612ee7a0a3',
      bill_id: 'b2222222-2222-2222-2222-222222222222',
      store_id: STORE_ID,
      payment_number: 'PAY-GDJ-002',
      payment_date: '2026-11-15',
      amount: 90000.00,
      payment_mode: 'cheque',
      payment_channel: 'official_bank',
      transaction_ref: '102942',
      cheque_date: '2026-11-15',
      notes: '2nd Cheque #102942 (SBI) final clearance'
    },
    // Godrej Bill 2 Payments (PDC Issued)
    {
      dealer_id: 'fbbf0bfa-69ac-4445-b5fe-35612ee7a0a3',
      bill_id: 'b3333333-3333-3333-3333-333333333333',
      store_id: STORE_ID,
      payment_number: 'PAY-GDJ-003',
      payment_date: '2026-11-18',
      amount: 50000.00,
      payment_mode: 'cheque',
      payment_channel: 'official_bank',
      transaction_ref: '102955',
      cheque_date: '2026-12-05',
      notes: 'PDC (Post-Dated Cheque) #102955 (SBI) handed over to Godrej agent, clearing date 05 Dec 2026'
    },
    // Sleepwell Payments
    {
      dealer_id: '1bb5d38c-f751-4bb7-94ee-e6c44ea19da2',
      bill_id: 'c4444444-4444-4444-4444-444444444444',
      store_id: STORE_ID,
      payment_number: 'PAY-SLP-001',
      payment_date: '2026-11-04',
      amount: 35000.00,
      payment_mode: 'bank_transfer',
      payment_channel: 'official_bank',
      transaction_ref: 'UPI/43190291902',
      cheque_date: null,
      notes: 'Immediate UPI advance on dispatch intimation'
    },
    {
      dealer_id: '1bb5d38c-f751-4bb7-94ee-e6c44ea19da2',
      bill_id: 'c4444444-4444-4444-4444-444444444444',
      store_id: STORE_ID,
      payment_number: 'PAY-SLP-002',
      payment_date: '2026-11-16',
      amount: 35000.00,
      payment_mode: 'cheque',
      payment_channel: 'official_bank',
      transaction_ref: '772810',
      cheque_date: '2026-11-16',
      notes: 'Cheque #772810 (PNB) cleared against SLP/2026/882'
    },
    // Onida Payment
    {
      dealer_id: 'c3b77241-e970-4f59-9943-41bbd5641772',
      bill_id: 'd5555555-5555-5555-5555-555555555555',
      store_id: STORE_ID,
      payment_number: 'PAY-ONI-001',
      payment_date: '2026-10-20',
      amount: 30000.00,
      payment_mode: 'cheque',
      payment_channel: 'official_bank',
      transaction_ref: '509211',
      cheque_date: '2026-10-20',
      notes: 'Cheque #509211 on ONI-INV-7104'
    },
    // Noor Workshop (Kaccha Cash on Delivery)
    {
      dealer_id: 'd8e62241-1120-4a89-9132-72ccfa659114',
      bill_id: 'e6666666-6666-6666-6666-666666666666',
      store_id: STORE_ID,
      payment_number: 'PAY-NOOR-001',
      payment_date: '2026-11-14',
      amount: 20000.00,
      payment_mode: 'cash',
      payment_channel: 'secondary_cash',
      transaction_ref: null,
      cheque_date: null,
      notes: 'Cash handed over to tempo driver upon sofa unloading'
    }
  ];

  const { error: insPmtsErr } = await supabase.from('dealer_payments').insert(payments);
  if (insPmtsErr) {
    console.error('Error inserting payments:', insPmtsErr);
    return;
  }
  console.log('Payments inserted successfully! Triggers updated bill balances.');
  console.log('ALL SEEDING COMPLETED!');
}

seed().catch(console.error);
