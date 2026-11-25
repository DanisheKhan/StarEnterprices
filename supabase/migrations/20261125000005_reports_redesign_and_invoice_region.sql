-- ============================================================================
-- Migration: Reports Console Redesign (Accurate Excl-GST Profit, EMI vs Cash
-- Persons Count, Invoice Region Persistence, This Month Profit & Levers)
-- ============================================================================

-- 1. Persist Customer Region & Address on Invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_region text,
  ADD COLUMN IF NOT EXISTS customer_address text;

CREATE INDEX IF NOT EXISTS idx_invoices_store_created_region
  ON public.invoices (store_id, created_at DESC, customer_region);

-- 2. Upgrade place_sale to save customer_region and customer_address
CREATE OR REPLACE FUNCTION public.place_sale(
  p_store_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_gstin text,
  p_items jsonb,
  p_payments jsonb,
  p_customer_region text DEFAULT NULL,
  p_customer_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_store record;
  v_prefix text;
  v_fy text := '2026-27';
  v_next_num integer;
  v_invoice_num text;
  v_invoice_id uuid;
  v_item record;
  v_prod record;
  v_unit record;
  v_inv_qty integer;
  v_serial_number text;
  v_was_used_serial boolean;
  v_subtotal numeric(12, 2) := 0;
  v_discount_total numeric(12, 2) := 0;
  v_cgst_total numeric(12, 2) := 0;
  v_sgst_total numeric(12, 2) := 0;
  v_grand_total numeric(12, 2) := 0;
  v_taxable numeric(12, 2);
  v_item_cgst numeric(12, 2);
  v_item_sgst numeric(12, 2);
  v_item_total numeric(12, 2);
  v_qty integer;
  v_price numeric(12, 2);
  v_disc numeric(12, 2);
  v_payment record;
  v_paid_total numeric(12, 2) := 0;
  v_status text := 'paid';
  v_is_cash_bill boolean := false;
begin
  if not public.user_has_store_access(p_store_id, array['owner', 'manager', 'cashier']) then
    raise exception 'Permission denied for this store' using errcode = '42501';
  end if;

  select * into v_store from public.stores where id = p_store_id and is_active = true;
  if not found then
    raise exception 'Store not found or inactive';
  end if;
  v_prefix := v_store.invoice_prefix;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'A bill must contain at least one item';
  end if;

  if (
    select count(distinct nullif(e->>'unit_id', ''))
    from jsonb_array_elements(p_items) e
    where nullif(e->>'unit_id', '') is not null
  ) <> (
    select count(*)
    from jsonb_array_elements(p_items) e
    where nullif(e->>'unit_id', '') is not null
  ) then
    raise exception 'The same serial number cannot be billed twice on one bill';
  end if;

  for v_item in select * from jsonb_to_recordset(p_items) as (
    product_id uuid,
    unit_id uuid,
    quantity integer,
    unit_price numeric,
    discount numeric
  )
  loop
    select * into v_prod from public.products where id = v_item.product_id and store_id = p_store_id;
    if not found then
      raise exception 'Product % not found in store', v_item.product_id;
    end if;

    if v_prod.is_serialized and v_item.unit_id is null then
      raise exception 'Serial number is required for %', v_prod.name;
    end if;

    if v_item.unit_id is not null and coalesce(v_item.quantity, 1) <> 1 then
      raise exception 'Each serial number is billed as a single unit (quantity 1) for %', v_prod.name;
    end if;

    v_qty := greatest(1, coalesce(v_item.quantity, 1));
    v_price := coalesce(v_item.unit_price, v_prod.selling_price);
    v_disc := coalesce(v_item.discount, 0);

    if (v_price - v_disc) < v_prod.min_selling_price then
      raise exception 'Price for % is below minimum permitted selling price of %', v_prod.name, v_prod.min_selling_price;
    end if;

    v_taxable := round((v_price - v_disc) * v_qty);
    v_item_cgst := round((v_taxable * (v_prod.gst_rate / 2.0) / 100.0));
    v_item_sgst := round((v_taxable * (v_prod.gst_rate / 2.0) / 100.0));
    v_item_total := v_taxable + v_item_cgst + v_item_sgst;

    v_subtotal := v_subtotal + round(v_price * v_qty);
    v_discount_total := v_discount_total + round(v_disc * v_qty);
    v_cgst_total := v_cgst_total + v_item_cgst;
    v_sgst_total := v_sgst_total + v_item_sgst;
    v_grand_total := v_grand_total + v_item_total;
  end loop;

  v_grand_total := round(v_grand_total);

  if p_payments is not null and jsonb_array_length(p_payments) > 0 then
    select coalesce(sum(round((p->>'amount')::numeric)), 0) into v_paid_total
    from jsonb_array_elements(p_payments) p;

    v_is_cash_bill := not exists (
      select 1 from jsonb_array_elements(p_payments) p
      where coalesce((p->>'amount')::numeric, 0) > 0
        and coalesce(p->>'payment_method', '') <> 'cash'
    );
  else
    v_paid_total := 0;
  end if;

  v_is_cash_bill := v_is_cash_bill and v_paid_total >= v_grand_total;

  if v_paid_total <= 0 then
    v_status := 'pending';
  elsif v_paid_total < v_grand_total then
    v_status := 'partial';
  else
    v_status := 'paid';
  end if;

  insert into public.invoice_counters (store_id, financial_year, current_number)
  values (p_store_id, v_fy, 1)
  on conflict (store_id, financial_year)
  do update set current_number = public.invoice_counters.current_number + 1
  returning current_number into v_next_num;

  v_invoice_num := v_prefix || '-' || '2026' || '-' || lpad(v_next_num::text, 4, '0');

  insert into public.invoices (
    store_id,
    invoice_number,
    financial_year,
    customer_name,
    customer_phone,
    customer_gstin,
    customer_region,
    customer_address,
    subtotal,
    discount_amount,
    cgst_amount,
    sgst_amount,
    igst_amount,
    grand_total,
    status,
    cashier_id
  ) values (
    p_store_id,
    v_invoice_num,
    v_fy,
    coalesce(nullif(trim(p_customer_name), ''), 'Walk-in Customer'),
    p_customer_phone,
    p_customer_gstin,
    nullif(trim(p_customer_region), ''),
    nullif(trim(p_customer_address), ''),
    v_subtotal,
    v_discount_total,
    v_cgst_total,
    v_sgst_total,
    0,
    v_grand_total,
    v_status,
    (select auth.uid())
  ) returning id into v_invoice_id;

  for v_item in select * from jsonb_to_recordset(p_items) as (
    product_id uuid,
    unit_id uuid,
    quantity integer,
    unit_price numeric,
    discount numeric
  )
  loop
    select * into v_prod from public.products where id = v_item.product_id;
    v_qty := greatest(1, coalesce(v_item.quantity, 1));
    v_price := coalesce(v_item.unit_price, v_prod.selling_price);
    v_disc := coalesce(v_item.discount, 0);

    v_taxable := round((v_price - v_disc) * v_qty);
    v_item_cgst := round((v_taxable * (v_prod.gst_rate / 2.0) / 100.0));
    v_item_sgst := round((v_taxable * (v_prod.gst_rate / 2.0) / 100.0));
    v_item_total := v_taxable + v_item_cgst + v_item_sgst;

    if v_item.unit_id is not null then
      select * into v_unit from public.product_units
      where id = v_item.unit_id
        and store_id = p_store_id
        and status in ('in_stock', 'sold')
        and (
          (status = 'in_stock' and product_id = v_item.product_id)
          or status = 'sold'
        )
      for update;

      if not found then
        raise exception 'Serial number for % is not available for billing', v_prod.name;
      end if;

      if v_unit.status = 'sold' and not v_is_cash_bill then
        raise exception 'Serial % has already been used. A used serial number can only be billed on a fully paid cash bill.', v_unit.serial_number;
      end if;

      v_was_used_serial := (v_unit.status = 'sold');
      v_serial_number := v_unit.serial_number;

      update public.product_units
      set status = case when v_was_used_serial then 'retired' else 'sold' end,
          updated_at = now()
      where id = v_item.unit_id;

      insert into public.order_items (
        invoice_id, product_id, unit_id, item_name, serial_number, hsn_code,
        quantity, unit_price, discount, taxable_value, gst_rate, cgst_amount, sgst_amount, total_amount
      ) values (
        v_invoice_id, v_item.product_id, v_item.unit_id, v_prod.name, v_serial_number, v_prod.hsn_code,
        v_qty, v_price, v_disc, v_taxable, v_prod.gst_rate, v_item_cgst, v_item_sgst, v_item_total
      );

      if not v_was_used_serial then
        insert into public.stock_movements (
          store_id, product_id, unit_id, movement_type, quantity, cost_price, reference_id, created_by
        ) values (
          p_store_id, v_item.product_id, v_item.unit_id, 'sale', -v_qty, v_prod.cost_price, v_invoice_num, (select auth.uid())
        );

        update public.inventory
        set quantity_on_hand = greatest(0, quantity_on_hand - v_qty),
            updated_at = now()
        where store_id = p_store_id and product_id = v_item.product_id;
      end if;
    else
      select quantity_on_hand into v_inv_qty
      from public.inventory
      where store_id = p_store_id and product_id = v_item.product_id
      for update;

      if coalesce(v_inv_qty, 0) < v_qty then
        raise exception 'Insufficient stock for % (available: %)', v_prod.name, coalesce(v_inv_qty, 0);
      end if;

      insert into public.order_items (
        invoice_id, product_id, unit_id, item_name, serial_number, hsn_code,
        quantity, unit_price, discount, taxable_value, gst_rate, cgst_amount, sgst_amount, total_amount
      ) values (
        v_invoice_id, v_item.product_id, null, v_prod.name, null, v_prod.hsn_code,
        v_qty, v_price, v_disc, v_taxable, v_prod.gst_rate, v_item_cgst, v_item_sgst, v_item_total
      );

      insert into public.stock_movements (
        store_id, product_id, unit_id, movement_type, quantity, cost_price, reference_id, created_by
      ) values (
        p_store_id, v_item.product_id, null, 'sale', -v_qty, v_prod.cost_price, v_invoice_num, (select auth.uid())
      );

      update public.inventory
      set quantity_on_hand = greatest(0, quantity_on_hand - v_qty),
          updated_at = now()
      where store_id = p_store_id and product_id = v_item.product_id;
    end if;
  end loop;

  if p_payments is not null and jsonb_array_length(p_payments) > 0 then
    for v_payment in select * from jsonb_to_recordset(p_payments) as (
      payment_method text,
      amount numeric,
      reference_number text
    )
    loop
      if coalesce(v_payment.amount, 0) > 0 then
        insert into public.payments (
          invoice_id, payment_method, amount, reference_number
        ) values (
          v_invoice_id, v_payment.payment_method, round(v_payment.amount), v_payment.reference_number
        );
      end if;
    end loop;
  end if;

  insert into public.audit_log (
    store_id, user_id, action, entity_type, entity_id, details
  ) values (
    p_store_id, (select auth.uid()), 'create', 'invoice', v_invoice_id::text,
    jsonb_build_object(
      'invoice_number', v_invoice_num,
      'grand_total', v_grand_total,
      'paid_amount', v_paid_total,
      'status', v_status,
      'cash_bill', v_is_cash_bill,
      'customer_region', nullif(trim(p_customer_region), '')
    )
  );

  return jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_num,
    'grand_total', v_grand_total,
    'paid_total', v_paid_total,
    'status', v_status
  );
end;
$function$;

-- 3. Rebuild get_owner_dashboard_metrics with Excl-GST Profit Math, This Month Profit,
--    EMI vs Cash Customer Counts, Region Reach, Real Period Growth, & Profit Levers
CREATE OR REPLACE FUNCTION public.get_owner_dashboard_metrics(
  p_date_range text DEFAULT 'month'::text,
  p_store_code text DEFAULT 'all'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_now_ist timestamp := now() at time zone 'Asia/Kolkata';
  v_today_ist date := v_now_ist::date;
  v_month_start timestamptz := (date_trunc('month', v_now_ist)::timestamp at time zone 'Asia/Kolkata');
  v_prev_month_start timestamptz := ((date_trunc('month', v_now_ist) - interval '1 month')::timestamp at time zone 'Asia/Kolkata');
  v_date_filter timestamptz := null;
  v_prev_start timestamptz := null;
  v_prev_end timestamptz := null;
  v_window_days int := case when p_date_range = 'month' then extract(day from v_now_ist)::int else 7 end;
  v_series_start_date date := case when p_date_range = 'month' then date_trunc('month', v_now_ist)::date else (v_today_ist - 6) end;

  -- Selected Period Financials (Single Source of Truth)
  v_total_sales numeric := 0;
  v_total_subtotal numeric := 0;
  v_total_discount numeric := 0;
  v_total_gst numeric := 0;
  v_cgst_total numeric := 0;
  v_sgst_total numeric := 0;
  v_net_revenue numeric := 0;
  v_total_invoices int := 0;
  v_discounted_bills int := 0;
  v_average_ticket numeric := 0;
  v_total_units_sold int := 0;
  v_total_cogs numeric := 0;
  v_est_gross_profit numeric := 0;
  v_gross_margin_pct numeric := 0;
  v_units_per_tx numeric := 1.0;

  -- Real Previous Period Delta
  v_prev_net_revenue numeric := 0;
  v_delta_pct numeric := null;

  -- Always-Current IST Month Profit
  v_m_gross_sales numeric := 0;
  v_m_net_revenue numeric := 0;
  v_m_cogs numeric := 0;
  v_m_invoices int := 0;
  v_m_card numeric := 0;
  v_m_card_mdr numeric := 0;
  v_m_gross_profit numeric := 0;
  v_m_net_profit numeric := 0;
  v_m_margin_pct numeric := 0;

  -- Inventory Valuation
  v_total_inventory_val numeric := 0;
  v_potential_retail_val numeric := 0;
  v_unrealized_profit numeric := 0;
  v_total_stock_units int := 0;
  v_total_skus int := 0;
  v_healthy_skus int := 0;
  v_low_stock_skus int := 0;
  v_out_of_stock_skus int := 0;
  v_healthy_inv_pct numeric := 100;

  -- Payment Methods (Amount + Distinct Persons/Invoices)
  v_upi numeric := 0;
  v_card numeric := 0;
  v_cash numeric := 0;
  v_emi numeric := 0;
  v_upi_cnt int := 0;
  v_card_cnt int := 0;
  v_cash_cnt int := 0;
  v_emi_cnt int := 0;
  v_payments_sum numeric := 1;
  v_card_mdr_cost numeric := 0;
  v_net_profit numeric := 0;
  v_net_margin_pct numeric := 0;
  v_potential_mdr_savings numeric := 0;
  v_high_cash_opp_cnt int := 0;
  v_high_cash_opp_val numeric := 0;

  -- Attach Rate
  v_device_bills int := 0;
  v_attached_bills int := 0;
  v_attach_rate_pct numeric := 0;
  v_phone_rev numeric := 0;
  v_acc_rev numeric := 0;
  v_target_attach_gain numeric := 0;

  -- Receivables, Dead Stock & Fast-Mover Alerts
  v_pending_receivables numeric := 0;
  v_pending_bills_cnt int := 0;
  v_pending_items jsonb := '[]'::jsonb;

  v_dead_capital numeric := 0;
  v_dead_count int := 0;
  v_dead_items jsonb := '[]'::jsonb;

  v_all_stockout_alerts jsonb := '[]'::jsonb;
  v_top_stockout_alerts jsonb := '[]'::jsonb;
  v_stockout_rev_at_risk numeric := 0;

  -- Datasets
  v_branches jsonb := '[]'::jsonb;
  v_stores_map jsonb := '{}'::jsonb;
  v_categories jsonb := '[]'::jsonb;
  v_star_products jsonb := '[]'::jsonb;
  v_regions jsonb := '[]'::jsonb;
  v_hourly_sales jsonb := '[]'::jsonb;
  v_velocity_points jsonb := '[]'::jsonb;
  v_lifetime_months jsonb := '[]'::jsonb;
  v_lifetime_totals jsonb := '{}'::jsonb;
  v_recent_invoices jsonb := '[]'::jsonb;

  v_active_billing_days int := 1;
  v_run_rate_daily numeric := 0;
  v_proj_month_rev numeric := 0;
  v_proj_month_profit numeric := 0;
  v_opening_inv text := null;
  v_closing_inv text := null;
begin
  if not public.is_owner() then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  if p_date_range = 'today' then
    v_date_filter := (v_today_ist::timestamp at time zone 'Asia/Kolkata');
    v_prev_start := ((v_today_ist - 1)::timestamp at time zone 'Asia/Kolkata');
    v_prev_end := v_date_filter;
  elsif p_date_range = 'week' then
    v_date_filter := now() - interval '7 days';
    v_prev_start := now() - interval '14 days';
    v_prev_end := v_date_filter;
  elsif p_date_range = 'month' then
    v_date_filter := v_month_start;
    v_prev_start := v_prev_month_start;
    v_prev_end := v_prev_month_start + (now() - v_month_start);
  end if;

  -- 1. Selected Period Sales (Grand vs Net Excl GST)
  select
    coalesce(sum(i.grand_total), 0),
    coalesce(sum(i.subtotal), 0),
    coalesce(sum(i.discount_amount), 0),
    coalesce(sum(coalesce(i.cgst_amount, 0)), 0),
    coalesce(sum(coalesce(i.sgst_amount, 0)), 0),
    coalesce(sum(coalesce(i.cgst_amount, 0) + coalesce(i.sgst_amount, 0) + coalesce(i.igst_amount, 0)), 0),
    coalesce(sum(greatest(0, coalesce(i.subtotal, 0) - coalesce(i.discount_amount, 0))), 0),
    count(i.id)::int,
    count(i.id) filter (where coalesce(i.discount_amount, 0) > 0)::int
  into
    v_total_sales, v_total_subtotal, v_total_discount,
    v_cgst_total, v_sgst_total, v_total_gst,
    v_net_revenue, v_total_invoices, v_discounted_bills
  from public.invoices i
  join public.stores s on s.id = i.store_id
  where i.status <> 'void'
    and (v_date_filter is null or i.created_at >= v_date_filter)
    and (p_store_code = 'all' or s.code = p_store_code);

  if v_net_revenue = 0 and v_total_sales > 0 then
    v_net_revenue := greatest(0, v_total_sales - v_total_gst);
  end if;

  -- Opening & Closing invoice numbers in scope
  select
    min(i.invoice_number),
    max(i.invoice_number)
  into v_opening_inv, v_closing_inv
  from public.invoices i
  join public.stores s on s.id = i.store_id
  where i.status <> 'void'
    and (v_date_filter is null or i.created_at >= v_date_filter)
    and (p_store_code = 'all' or s.code = p_store_code);

  -- Previous period net revenue for honest deltaPct
  if v_prev_start is not null and v_prev_end is not null then
    select coalesce(sum(greatest(0, coalesce(i.subtotal, 0) - coalesce(i.discount_amount, 0))), 0)
    into v_prev_net_revenue
    from public.invoices i
    join public.stores s on s.id = i.store_id
    where i.status <> 'void'
      and i.created_at >= v_prev_start
      and i.created_at < v_prev_end
      and (p_store_code = 'all' or s.code = p_store_code);

    if v_prev_net_revenue > 0 then
      v_delta_pct := round((((v_net_revenue - v_prev_net_revenue) / v_prev_net_revenue) * 100.0)::numeric, 1);
    end if;
  end if;

  -- Selected Period COGS & Units Sold
  select
    coalesce(sum(coalesce(oi.quantity, 1)), 0)::int,
    coalesce(sum(coalesce(p.cost_price, 0) * coalesce(oi.quantity, 1)), 0)
  into v_total_units_sold, v_total_cogs
  from public.order_items oi
  join public.invoices i on i.id = oi.invoice_id
  join public.stores s on s.id = i.store_id
  left join public.products p on p.id = oi.product_id
  where i.status <> 'void'
    and (v_date_filter is null or i.created_at >= v_date_filter)
    and (p_store_code = 'all' or s.code = p_store_code);

  v_average_ticket := case when v_total_invoices > 0 then round(v_total_sales / v_total_invoices) else 0 end;
  -- TRUE Gross Profit = Net Revenue (Excl. GST) - Product COGS
  v_est_gross_profit := case when v_total_invoices > 0 then round(v_net_revenue - v_total_cogs) else 0 end;
  v_gross_margin_pct := case when v_net_revenue > 0 then round(((v_est_gross_profit / v_net_revenue) * 100.0)::numeric, 1) else 0 end;
  v_units_per_tx := case when v_total_invoices > 0 then round((v_total_units_sold::numeric / v_total_invoices), 1) else 0 end;

  -- 2. Always-Current IST Calendar Month Profit (Independent of filter)
  select
    coalesce(sum(i.grand_total), 0),
    coalesce(sum(greatest(0, coalesce(i.subtotal, 0) - coalesce(i.discount_amount, 0))), 0),
    count(i.id)::int
  into v_m_gross_sales, v_m_net_revenue, v_m_invoices
  from public.invoices i
  join public.stores s on s.id = i.store_id
  where i.status <> 'void'
    and i.created_at >= v_month_start
    and (p_store_code = 'all' or s.code = p_store_code);

  select
    coalesce(sum(coalesce(p.cost_price, 0) * coalesce(oi.quantity, 1)), 0)
  into v_m_cogs
  from public.order_items oi
  join public.invoices i on i.id = oi.invoice_id
  join public.stores s on s.id = i.store_id
  left join public.products p on p.id = oi.product_id
  where i.status <> 'void'
    and i.created_at >= v_month_start
    and (p_store_code = 'all' or s.code = p_store_code);

  select
    coalesce(sum(p.amount) filter (where lower(coalesce(p.payment_method, 'cash')) = 'card'), 0)
  into v_m_card
  from public.payments p
  join public.invoices i on i.id = p.invoice_id
  join public.stores s on s.id = i.store_id
  where i.status <> 'void'
    and i.created_at >= v_month_start
    and (p_store_code = 'all' or s.code = p_store_code);

  v_m_gross_profit := case when v_m_invoices > 0 then round(v_m_net_revenue - v_m_cogs) else 0 end;
  v_m_card_mdr := round(v_m_card * 0.018);
  v_m_net_profit := case when v_m_invoices > 0 then round(v_m_gross_profit - v_m_card_mdr) else 0 end;
  v_m_margin_pct := case when v_m_net_revenue > 0 then round(((v_m_net_profit / v_m_net_revenue) * 100.0)::numeric, 1) else 0 end;

  -- 3. Inventory Items Valuation (At Cost & At Retail)
  with active_prods as (
    select
      p.id, p.cost_price, p.selling_price, coalesce(p.reorder_level, 2) as reorder_level,
      coalesce(sum(inv.quantity_on_hand), 0)::int as qty
    from public.products p
    join public.stores s on s.id = p.store_id
    left join public.inventory inv on inv.product_id = p.id
    where p.is_active = true
      and (p_store_code = 'all' or s.code = p_store_code)
    group by p.id
  )
  select
    coalesce(sum(cost_price * qty), 0),
    coalesce(sum(selling_price * qty), 0),
    coalesce(sum(qty), 0)::int,
    count(*)::int,
    count(*) filter (where qty > reorder_level)::int,
    count(*) filter (where qty > 0 and qty <= reorder_level)::int,
    count(*) filter (where qty <= 0)::int
  into
    v_total_inventory_val, v_potential_retail_val, v_total_stock_units,
    v_total_skus, v_healthy_skus, v_low_stock_skus, v_out_of_stock_skus
  from active_prods;

  v_unrealized_profit := greatest(0, v_potential_retail_val - v_total_inventory_val);
  v_healthy_inv_pct := case when v_total_skus > 0 then round(((v_healthy_skus::numeric / v_total_skus) * 100.0), 1) else 100 end;

  -- 4. Payment Channel Totals AND Distinct Customer/Bill Counts
  select
    coalesce(sum(p.amount) filter (where lower(coalesce(p.payment_method, 'cash')) = 'upi'), 0),
    coalesce(sum(p.amount) filter (where lower(coalesce(p.payment_method, 'cash')) = 'card'), 0),
    coalesce(sum(p.amount) filter (where lower(coalesce(p.payment_method, 'cash')) not in ('upi', 'card', 'emi')), 0),
    coalesce(sum(p.amount) filter (where lower(coalesce(p.payment_method, 'cash')) = 'emi'), 0),
    count(distinct i.id) filter (where lower(coalesce(p.payment_method, 'cash')) = 'upi' and p.amount > 0)::int,
    count(distinct i.id) filter (where lower(coalesce(p.payment_method, 'cash')) = 'card' and p.amount > 0)::int,
    count(distinct i.id) filter (where lower(coalesce(p.payment_method, 'cash')) not in ('upi', 'card', 'emi') and p.amount > 0)::int,
    count(distinct i.id) filter (where lower(coalesce(p.payment_method, 'cash')) = 'emi' and p.amount > 0)::int
  into v_upi, v_card, v_cash, v_emi, v_upi_cnt, v_card_cnt, v_cash_cnt, v_emi_cnt
  from public.payments p
  join public.invoices i on i.id = p.invoice_id
  join public.stores s on s.id = i.store_id
  where i.status <> 'void'
    and (v_date_filter is null or i.created_at >= v_date_filter)
    and (p_store_code = 'all' or s.code = p_store_code);

  v_payments_sum := nullif(v_upi + v_card + v_cash + v_emi, 0);
  if v_payments_sum is null then
    v_payments_sum := 1;
  end if;

  v_card_mdr_cost := round(v_card * 0.018);
  v_net_profit := case when v_total_invoices > 0 then round(v_est_gross_profit - v_card_mdr_cost) else 0 end;
  v_net_margin_pct := case when v_net_revenue > 0 then round(((v_net_profit / v_net_revenue) * 100.0)::numeric, 1) else 0 end;
  v_potential_mdr_savings := round(v_card * 0.5 * 0.018);

  -- Count high-ticket >= ₹15,000 non-EMI bills (EMI upsell opportunities)
  with non_emi_inv as (
    select i.id, i.grand_total
    from public.invoices i
    join public.stores s on s.id = i.store_id
    where i.status <> 'void'
      and i.grand_total >= 15000
      and (v_date_filter is null or i.created_at >= v_date_filter)
      and (p_store_code = 'all' or s.code = p_store_code)
      and not exists (
        select 1 from public.payments p
        where p.invoice_id = i.id and lower(coalesce(p.payment_method, '')) = 'emi' and p.amount > 0
      )
  )
  select count(*)::int, coalesce(sum(grand_total), 0)
  into v_high_cash_opp_cnt, v_high_cash_opp_val
  from non_emi_inv;

  -- 5. Pending Credit Receivables (Open balances across partial/pending bills)
  with inv_paid as (
    select
      i.id,
      i.invoice_number,
      coalesce(i.customer_name, 'Walk-in Customer') as customer_name,
      i.customer_phone,
      i.grand_total,
      coalesce(sum(p.amount), 0) as paid_amount,
      greatest(0, i.grand_total - coalesce(sum(p.amount), 0)) as balance_due,
      i.created_at,
      s.code as store_code
    from public.invoices i
    join public.stores s on s.id = i.store_id
    left join public.payments p on p.invoice_id = i.id
    where i.status in ('partial', 'pending')
      and (p_store_code = 'all' or s.code = p_store_code)
    group by i.id, s.code
    having i.grand_total - coalesce(sum(p.amount), 0) > 1
  )
  select
    coalesce(sum(balance_due), 0),
    count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'invoiceNumber', invoice_number,
      'customerName', customer_name,
      'customerPhone', customer_phone,
      'balanceDue', round(balance_due),
      'storeCode', store_code,
      'createdAt', created_at
    ) order by balance_due desc) filter (where rn <= 4), '[]'::jsonb)
  into v_pending_receivables, v_pending_bills_cnt, v_pending_items
  from (select *, row_number() over (order by balance_due desc) as rn from inv_paid) t;

  -- 6. High-Margin Low-Stock / Reorder Alerts
  with prod_vel as (
    select oi.product_id, coalesce(sum(oi.quantity), 0)::int as sold_units
    from public.order_items oi
    join public.invoices i on i.id = oi.invoice_id
    where i.status <> 'void' and i.created_at >= now() - interval '30 days'
    group by oi.product_id
  ),
  low_stock_prods as (
    select
      p.id,
      p.name,
      p.sku,
      s.code as store_code,
      coalesce(sum(inv.quantity_on_hand), 0)::int as current_stock,
      coalesce(p.reorder_level, 2) as reorder_level,
      coalesce(p.selling_price, 0) as selling_price,
      coalesce(p.cost_price, 0) as cost_price,
      greatest(0, coalesce(p.selling_price, 0) - coalesce(p.cost_price, 0)) as unit_profit,
      coalesce(max(pv.sold_units), 0) as recent_units_sold,
      greatest(1, coalesce(p.reorder_level, 2)) * coalesce(p.selling_price, 0) as revenue_at_risk
    from public.products p
    join public.stores s on s.id = p.store_id
    left join public.inventory inv on inv.product_id = p.id
    left join prod_vel pv on pv.product_id = p.id
    where p.is_active = true
      and (p_store_code = 'all' or s.code = p_store_code)
    group by p.id, s.code
    having coalesce(sum(inv.quantity_on_hand), 0) <= coalesce(p.reorder_level, 2)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'sku', sku,
    'storeCode', store_code,
    'currentStock', current_stock,
    'reorderLevel', reorder_level,
    'sellingPrice', selling_price,
    'costPrice', cost_price,
    'unitProfit', unit_profit,
    'recentUnitsSold', recent_units_sold,
    'revenueAtRisk', revenue_at_risk
  ) order by recent_units_sold desc, current_stock asc, name asc), '[]'::jsonb)
  into v_all_stockout_alerts
  from low_stock_prods;

  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  into v_top_stockout_alerts
  from (
    select elem from jsonb_array_elements(v_all_stockout_alerts) with ordinality t(elem, ord)
    where ord <= 4
  ) s;

  select coalesce(sum((elem->>'revenueAtRisk')::numeric), 0)
  into v_stockout_rev_at_risk
  from jsonb_array_elements(v_top_stockout_alerts) elem;

  -- 7. Branches / Stores Split (Including Stock Valuation per Store)
  with store_inv as (
    select
      s.id as store_id, s.code, s.name, s.gstin,
      count(distinct i.id) filter (where i.status <> 'void' and (v_date_filter is null or i.created_at >= v_date_filter))::int as inv_count,
      coalesce(sum(i.grand_total) filter (where i.status <> 'void' and (v_date_filter is null or i.created_at >= v_date_filter)), 0) as sales_total,
      coalesce(sum(greatest(0, coalesce(i.subtotal, 0) - coalesce(i.discount_amount, 0))) filter (where i.status <> 'void' and (v_date_filter is null or i.created_at >= v_date_filter)), 0) as net_total,
      coalesce(sum(coalesce(i.cgst_amount, 0) + coalesce(i.sgst_amount, 0) + coalesce(i.igst_amount, 0)) filter (where i.status <> 'void' and (v_date_filter is null or i.created_at >= v_date_filter)), 0) as gst_total
    from public.stores s
    left join public.invoices i on i.store_id = s.id
    where s.is_active = true
    group by s.id
  ),
  store_cogs as (
    select
      i.store_id,
      coalesce(sum(coalesce(p.cost_price, 0) * coalesce(oi.quantity, 1)), 0) as cogs_total
    from public.order_items oi
    join public.invoices i on i.id = oi.invoice_id
    left join public.products p on p.id = oi.product_id
    where i.status <> 'void'
      and (v_date_filter is null or i.created_at >= v_date_filter)
    group by i.store_id
  ),
  store_stock as (
    select
      p.store_id,
      count(distinct p.id)::int as active_skus,
      coalesce(sum(inv.quantity_on_hand), 0)::int as stock_units,
      coalesce(sum(p.cost_price * inv.quantity_on_hand), 0) as stock_cost,
      coalesce(sum(p.selling_price * inv.quantity_on_hand), 0) as stock_retail
    from public.products p
    left join public.inventory inv on inv.product_id = p.id
    where p.is_active = true
    group by p.store_id
  ),
  store_low_alerts as (
    select
      elem->>'storeCode' as code,
      count(*)::int as low_count
    from jsonb_array_elements(v_all_stockout_alerts) elem
    group by elem->>'storeCode'
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'code', si.code,
      'name', si.name,
      'gstin', si.gstin,
      'sales', si.sales_total,
      'grossSales', si.sales_total,
      'netRevenue', si.net_total,
      'cogs', coalesce(sc.cogs_total, 0),
      'profit', case when si.inv_count > 0 then round(si.net_total - coalesce(sc.cogs_total, 0)) else 0 end,
      'marginPct', case when si.net_total > 0 then round((((si.net_total - coalesce(sc.cogs_total, 0)) / si.net_total) * 100.0)::numeric, 1) else 0 end,
      'invoices', si.inv_count,
      'aov', case when si.inv_count > 0 then round(si.sales_total / si.inv_count) else 0 end,
      'gst', si.gst_total,
      'activeSkus', coalesce(ss.active_skus, 0),
      'stockUnits', coalesce(ss.stock_units, 0),
      'stockCostValue', coalesce(ss.stock_cost, 0),
      'stockRetailValue', coalesce(ss.stock_retail, 0)
    ) order by si.name), '[]'::jsonb),
    coalesce(jsonb_object_agg(si.code, jsonb_build_object(
      'sales', si.sales_total,
      'netRevenue', si.net_total,
      'profit', case when si.inv_count > 0 then round(si.net_total - coalesce(sc.cogs_total, 0)) else 0 end,
      'invoiceCount', si.inv_count,
      'lowStockCount', coalesce(sla.low_count, 0)
    )), '{}'::jsonb)
  into v_branches, v_stores_map
  from store_inv si
  left join store_cogs sc on sc.store_id = si.store_id
  left join store_stock ss on ss.store_id = si.store_id
  left join store_low_alerts sla on sla.code = si.code;

  -- 8. Most Selling Categories (Excl. GST Net Revenue & Profit)
  with cat_sales as (
    select
      coalesce(c.name, 'General') as name,
      coalesce(c.slug, 'general') as slug,
      coalesce(sum(oi.taxable_value), 0) as net_revenue,
      coalesce(sum(oi.total_amount), 0) as gross_revenue,
      coalesce(sum(coalesce(p.cost_price, 0) * coalesce(oi.quantity, 1)), 0) as cogs,
      coalesce(sum(coalesce(oi.quantity, 1)), 0)::int as units
    from public.order_items oi
    join public.invoices i on i.id = oi.invoice_id
    join public.stores s on s.id = i.store_id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    where i.status <> 'void'
      and (v_date_filter is null or i.created_at >= v_date_filter)
      and (p_store_code = 'all' or s.code = p_store_code)
    group by coalesce(c.name, 'General'), coalesce(c.slug, 'general')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', name,
    'slug', slug,
    'revenue', net_revenue,
    'netRevenue', net_revenue,
    'grossRevenue', gross_revenue,
    'cogs', cogs,
    'profit', round(net_revenue - cogs),
    'marginPct', case when net_revenue > 0 then round((((net_revenue - cogs) / net_revenue) * 100.0)::numeric, 1) else 0 end,
    'units', units,
    'revenueShare', case when v_net_revenue > 0 then round(((net_revenue / v_net_revenue) * 100.0)::numeric, 1) else 0 end
  ) order by net_revenue desc), '[]'::jsonb)
  into v_categories
  from cat_sales;

  -- Real Device vs Accessory Attach Rate
  select
    coalesce(sum((elem->>'netRevenue')::numeric) filter (where elem->>'slug' = 'smartphones'), 0),
    coalesce(sum((elem->>'netRevenue')::numeric) filter (where elem->>'slug' = 'accessories'), 0)
  into v_phone_rev, v_acc_rev
  from jsonb_array_elements(v_categories) elem;

  with big_item_invoices as (
    select distinct oi.invoice_id
    from public.order_items oi
    join public.invoices i on i.id = oi.invoice_id
    join public.stores s on s.id = i.store_id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    where i.status <> 'void'
      and (v_date_filter is null or i.created_at >= v_date_filter)
      and (p_store_code = 'all' or s.code = p_store_code)
      and coalesce(c.slug, '') in ('smartphones', 'televisions', 'refrigerators', 'washing-machines', 'second-hand-phones')
  ),
  with_addon as (
    select distinct oi.invoice_id
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    where oi.invoice_id in (select invoice_id from big_item_invoices)
      and (coalesce(c.slug, '') = 'accessories' or p.is_serialized = false)
  )
  select count(distinct b.invoice_id)::int, count(distinct a.invoice_id)::int
  into v_device_bills, v_attached_bills
  from big_item_invoices b
  left join with_addon a on a.invoice_id = b.invoice_id;

  v_attach_rate_pct := case when v_device_bills > 0 then round(((v_attached_bills::numeric / v_device_bills) * 100.0)::numeric, 1) else 0 end;
  v_target_attach_gain := greatest(0, round((v_device_bills * 0.30 - v_attached_bills) * 750));

  -- 9. Star Products (Excl. GST Net Revenue & True Profit)
  with prod_sales as (
    select
      coalesce(oi.product_id::text, oi.item_name) as pid,
      coalesce(p.name, oi.item_name, 'Store Item') as pname,
      coalesce(p.sku, 'SKU-001') as psku,
      coalesce(c.name, 'General') as cat_name,
      coalesce(c.slug, 'general') as cat_slug,
      coalesce(ps.code, 'furniture-electronics') as store_code,
      coalesce(ps.name, 'Star Furniture & Electronics') as store_name,
      coalesce(sum(oi.quantity), 0)::int as units_sold,
      coalesce(sum(oi.taxable_value), 0) as net_revenue,
      coalesce(sum(oi.total_amount), 0) as gross_revenue,
      coalesce(sum(coalesce(p.cost_price, 0) * coalesce(oi.quantity, 1)), 0) as cogs,
      coalesce(max(p.reorder_level), 2) as reorder_level,
      coalesce((select sum(inv.quantity_on_hand) from public.inventory inv where inv.product_id = p.id), 0)::int as cur_stock
    from public.order_items oi
    join public.invoices i on i.id = oi.invoice_id
    join public.stores ist on ist.id = i.store_id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    left join public.stores ps on ps.id = p.store_id
    where i.status <> 'void'
      and (v_date_filter is null or i.created_at >= v_date_filter)
      and (p_store_code = 'all' or ist.code = p_store_code)
    group by coalesce(oi.product_id::text, oi.item_name), p.id, p.name, p.sku, oi.item_name, c.name, c.slug, ps.code, ps.name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pid,
    'name', pname,
    'sku', psku,
    'category', cat_name,
    'categorySlug', cat_slug,
    'storeCode', store_code,
    'storeName', store_name,
    'unitsSold', units_sold,
    'revenue', net_revenue,
    'netRevenue', net_revenue,
    'grossRevenue', gross_revenue,
    'cogs', cogs,
    'profit', round(net_revenue - cogs),
    'marginPct', case when net_revenue > 0 then round((((net_revenue - cogs) / net_revenue) * 100.0)::numeric, 1) else 0 end,
    'revenueShare', case when v_net_revenue > 0 then round(((net_revenue / v_net_revenue) * 100.0)::numeric, 1) else 0 end,
    'currentStock', cur_stock,
    'reorderLevel', reorder_level,
    'stockStatus', case when cur_stock <= 0 then 'out_of_stock' when cur_stock <= reorder_level then 'low_stock' else 'healthy' end,
    'badge', case
      when units_sold >= 3 and net_revenue >= 50000 then 'Star Performer'
      when (case when net_revenue > 0 then ((net_revenue - cogs) / net_revenue) * 100.0 else 0 end) >= 25 then 'High Margin'
      when units_sold >= 2 then 'Volume Leader'
      else 'Active Seller'
    end
  ) order by net_revenue desc), '[]'::jsonb)
  into v_star_products
  from prod_sales;

  -- 10. Customer Region Reach Breakdown (Honest: Null -> Counter / Legacy)
  with inv_pay_flags as (
    select
      i.id,
      coalesce(nullif(trim(i.customer_region), ''), 'Counter / Unassigned') as region_name,
      coalesce(nullif(trim(i.customer_phone), ''), i.id::text) as cust_key,
      i.grand_total,
      greatest(0, coalesce(i.subtotal, 0) - coalesce(i.discount_amount, 0)) as net_rev,
      exists (select 1 from public.payments p where p.invoice_id = i.id and lower(coalesce(p.payment_method, '')) = 'emi' and p.amount > 0) as has_emi,
      exists (select 1 from public.payments p where p.invoice_id = i.id and lower(coalesce(p.payment_method, '')) not in ('upi', 'card', 'emi') and p.amount > 0) as has_cash
    from public.invoices i
    join public.stores s on s.id = i.store_id
    where i.status <> 'void'
      and (v_date_filter is null or i.created_at >= v_date_filter)
      and (p_store_code = 'all' or s.code = p_store_code)
  ),
  reg_agg as (
    select
      region_name,
      count(*)::int as bills_count,
      count(distinct cust_key)::int as customers_count,
      coalesce(sum(grand_total), 0) as gross_sales,
      coalesce(sum(net_rev), 0) as net_revenue,
      count(*) filter (where has_emi)::int as emi_count,
      count(*) filter (where has_cash)::int as cash_count
    from inv_pay_flags
    group by region_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'region', region_name,
    'billsCount', bills_count,
    'customersCount', customers_count,
    'grossSales', gross_sales,
    'netRevenue', net_revenue,
    'emiCount', emi_count,
    'cashCount', cash_count,
    'sharePct', case when v_total_sales > 0 then round(((gross_sales / v_total_sales) * 100.0)::numeric, 1) else 0 end
  ) order by gross_sales desc), '[]'::jsonb)
  into v_regions
  from reg_agg;

  -- 11. Dead Stock Capital (Active Stocked SKUs with 0 sales in last 30 days)
  with sold_ids as (
    select distinct oi.product_id
    from public.order_items oi
    join public.invoices i on i.id = oi.invoice_id
    join public.stores s on s.id = i.store_id
    where i.status <> 'void'
      and oi.product_id is not null
      and i.created_at >= now() - interval '30 days'
      and (p_store_code = 'all' or s.code = p_store_code)
  ),
  dead_prods as (
    select
      p.id, p.name, p.sku, s.code as store_code,
      coalesce(sum(inv.quantity_on_hand), 0)::int as qty,
      coalesce(p.cost_price, 0) as cost,
      coalesce(sum(inv.quantity_on_hand), 0) * coalesce(p.cost_price, 0) as trapped_capital
    from public.products p
    join public.stores s on s.id = p.store_id
    left join public.inventory inv on inv.product_id = p.id
    where p.is_active = true
      and (p_store_code = 'all' or s.code = p_store_code)
      and p.id not in (select product_id from sold_ids)
    group by p.id, s.code
    having coalesce(sum(inv.quantity_on_hand), 0) > 0
    order by trapped_capital desc
  )
  select
    coalesce(sum(trapped_capital), 0),
    count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'sku', sku, 'storeCode', store_code,
      'qty', qty, 'cost', cost, 'trappedCapital', trapped_capital
    )) filter (where rn <= 4), '[]'::jsonb)
  into v_dead_capital, v_dead_count, v_dead_items
  from (select *, row_number() over (order by trapped_capital desc) as rn from dead_prods) d;

  -- 12. Sales & Profit Velocity Chart (This Month starts at Day 1; All Time starts at Jan of year)
  if p_date_range = 'all' then
    with first_all as (
      select coalesce(min(date_trunc('year', i.created_at at time zone 'Asia/Kolkata')::date), date_trunc('year', v_now_ist)::date) as start_m
      from public.invoices i join public.stores s on s.id = i.store_id
      where i.status <> 'void' and (p_store_code = 'all' or s.code = p_store_code)
    ),
    month_series as (
      select generate_series(
        (select start_m from first_all),
        date_trunc('month', v_now_ist)::date,
        interval '1 month'
      )::date as m
    ),
    m_inv as (
      select
        date_trunc('month', i.created_at at time zone 'Asia/Kolkata')::date as m,
        coalesce(sum(greatest(0, coalesce(i.subtotal, 0) - coalesce(i.discount_amount, 0))), 0) as rev,
        coalesce(sum(i.grand_total), 0) as gross_rev,
        count(distinct i.id)::int as cnt
      from public.invoices i
      join public.stores s on s.id = i.store_id
      where i.status <> 'void'
        and (p_store_code = 'all' or s.code = p_store_code)
      group by 1
    ),
    m_cogs as (
      select
        date_trunc('month', i.created_at at time zone 'Asia/Kolkata')::date as m,
        coalesce(sum(coalesce(p.cost_price, 0) * coalesce(oi.quantity, 1)), 0) as cogs
      from public.order_items oi
      join public.invoices i on i.id = oi.invoice_id
      join public.stores s on s.id = i.store_id
      left join public.products p on p.id = oi.product_id
      where i.status <> 'void'
        and (p_store_code = 'all' or s.code = p_store_code)
      group by 1
    ),
    points as (
      select
        ms.m as d,
        round(coalesce(mi.rev, 0)) as rev,
        round(coalesce(mi.gross_rev, 0)) as gross_rev,
        round(coalesce(mc.cogs, 0)) as cogs,
        round(coalesce(mi.rev, 0) - coalesce(mc.cogs, 0)) as prof,
        coalesce(mi.cnt, 0) as cnt
      from month_series ms
      left join m_inv mi on mi.m = ms.m
      left join m_cogs mc on mc.m = ms.m
      order by ms.m asc
    )
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'date', to_char(d, 'YYYY-MM'),
        'label', to_char(d, 'Mon'),
        'fullLabel', trim(to_char(d, 'FMMonth YYYY')),
        'dayOfWeek', to_char(d, 'YYYY'),
        'revenue', rev,
        'grossRevenue', gross_rev,
        'profit', greatest(0, prof),
        'cogs', cogs,
        'marginPct', case when rev > 0 then round(((prof / rev) * 100.0)::numeric, 1) else 0 end,
        'invoices', cnt
      ) order by d asc), '[]'::jsonb),
      greatest(1, count(*) filter (where rev > 0)::int)
    into v_velocity_points, v_active_billing_days
    from points;
  else
    with day_series as (
      select generate_series(v_series_start_date, v_today_ist, interval '1 day')::date as d
    ),
    day_inv as (
      select
        (i.created_at at time zone 'Asia/Kolkata')::date as d,
        coalesce(sum(greatest(0, coalesce(i.subtotal, 0) - coalesce(i.discount_amount, 0))), 0) as rev,
        coalesce(sum(i.grand_total), 0) as gross_rev,
        count(distinct i.id)::int as cnt
      from public.invoices i
      join public.stores s on s.id = i.store_id
      where i.status <> 'void'
        and (v_date_filter is null or i.created_at >= v_date_filter)
        and (p_store_code = 'all' or s.code = p_store_code)
      group by 1
    ),
    day_cogs as (
      select
        (i.created_at at time zone 'Asia/Kolkata')::date as d,
        coalesce(sum(coalesce(p.cost_price, 0) * coalesce(oi.quantity, 1)), 0) as cogs
      from public.order_items oi
      join public.invoices i on i.id = oi.invoice_id
      join public.stores s on s.id = i.store_id
      left join public.products p on p.id = oi.product_id
      where i.status <> 'void'
        and (v_date_filter is null or i.created_at >= v_date_filter)
        and (p_store_code = 'all' or s.code = p_store_code)
      group by 1
    ),
    points as (
      select
        ds.d,
        round(coalesce(di.rev, 0)) as rev,
        round(coalesce(di.gross_rev, 0)) as gross_rev,
        round(coalesce(dc.cogs, 0)) as cogs,
        round(coalesce(di.rev, 0) - coalesce(dc.cogs, 0)) as prof,
        coalesce(di.cnt, 0) as cnt
      from day_series ds
      left join day_inv di on di.d = ds.d
      left join day_cogs dc on dc.d = ds.d
      order by ds.d asc
    )
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'date', to_char(d, 'YYYY-MM-DD'),
        'label', to_char(d, 'DD Mon'),
        'dayOfWeek', to_char(d, 'Dy'),
        'revenue', rev,
        'grossRevenue', gross_rev,
        'profit', greatest(0, prof),
        'cogs', cogs,
        'marginPct', case when rev > 0 then round(((prof / rev) * 100.0)::numeric, 1) else 0 end,
        'invoices', cnt
      ) order by d asc), '[]'::jsonb),
      greatest(1, count(*) filter (where rev > 0)::int)
    into v_velocity_points, v_active_billing_days
    from points;
  end if;

  -- Lifetime Monthly Performance Timeline: always starts at Month 1 (Jan of earliest active year) -> current month
  with first_inv as (
    select coalesce(min(date_trunc('year', i.created_at at time zone 'Asia/Kolkata')::date), date_trunc('year', v_now_ist)::date) as start_m
    from public.invoices i join public.stores s on s.id = i.store_id
    where i.status <> 'void' and (p_store_code = 'all' or s.code = p_store_code)
  ),
  lt_series as (
    select generate_series((select start_m from first_inv), date_trunc('month', v_now_ist)::date, interval '1 month')::date as m
  ),
  lt_inv as (
    select date_trunc('month', i.created_at at time zone 'Asia/Kolkata')::date as m,
      coalesce(sum(greatest(0, coalesce(i.subtotal, 0) - coalesce(i.discount_amount, 0))), 0) as rev,
      coalesce(sum(i.grand_total), 0) as gross_rev,
      count(distinct i.id)::int as cnt
    from public.invoices i join public.stores s on s.id = i.store_id
    where i.status <> 'void' and (p_store_code = 'all' or s.code = p_store_code) group by 1
  ),
  lt_cogs as (
    select date_trunc('month', i.created_at at time zone 'Asia/Kolkata')::date as m,
      coalesce(sum(coalesce(p.cost_price, 0) * coalesce(oi.quantity, 1)), 0) as cogs
    from public.order_items oi join public.invoices i on i.id = oi.invoice_id join public.stores s on s.id = i.store_id left join public.products p on p.id = oi.product_id
    where i.status <> 'void' and (p_store_code = 'all' or s.code = p_store_code) group by 1
  ),
  lt_pts as (
    select ms.m, round(coalesce(mi.rev, 0)) as rev, round(coalesce(mi.gross_rev, 0)) as gross_rev,
      round(coalesce(mc.cogs, 0)) as cogs, greatest(0, round(coalesce(mi.rev, 0) - coalesce(mc.cogs, 0))) as prof, coalesce(mi.cnt, 0) as cnt
    from lt_series ms left join lt_inv mi on mi.m = ms.m left join lt_cogs mc on mc.m = ms.m
  ),
  lt_cum as (
    select m, rev, gross_rev, cogs, prof, cnt,
      sum(rev) over (order by m asc) as cum_rev,
      sum(prof) over (order by m asc) as cum_prof
    from lt_pts
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'date', to_char(m, 'YYYY-MM'),
      'label', to_char(m, 'Mon'),
      'fullLabel', trim(to_char(m, 'FMMonth YYYY')),
      'revenue', rev,
      'grossRevenue', gross_rev,
      'profit', prof,
      'cogs', cogs,
      'invoices', cnt,
      'marginPct', case when rev > 0 then round(((prof / rev) * 100.0)::numeric, 1) else 0 end,
      'cumulativeRevenue', cum_rev,
      'cumulativeProfit', cum_prof
    ) order by m asc), '[]'::jsonb),
    jsonb_build_object(
      'netRevenue', coalesce(sum(rev), 0),
      'grossSales', coalesce(sum(gross_rev), 0),
      'profit', coalesce(sum(prof), 0),
      'billsCount', coalesce(sum(cnt), 0)::int,
      'avgMarginPct', case when sum(rev) > 0 then round(((sum(prof) / sum(rev)) * 100.0)::numeric, 1) else 0 end
    )
  into v_lifetime_months, v_lifetime_totals
  from lt_cum;

  v_run_rate_daily := case when v_net_revenue > 0 then round(v_net_revenue / v_active_billing_days) else 0 end;
  v_proj_month_rev := case when v_run_rate_daily > 0 then v_run_rate_daily * 30 else v_net_revenue end;
  v_proj_month_profit := round(v_proj_month_rev * (v_gross_margin_pct / 100.0));

  -- 13. Recent Invoices Stream
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'invoiceNumber', invoice_number,
    'storeName', store_name,
    'storeCode', store_code,
    'customerName', coalesce(customer_name, 'Walk-in Customer'),
    'customerRegion', coalesce(customer_region, 'Counter / Unassigned'),
    'grandTotal', coalesce(grand_total, 0),
    'subtotal', coalesce(subtotal, 0),
    'tax', coalesce(cgst_amount, 0) + coalesce(sgst_amount, 0) + coalesce(igst_amount, 0),
    'status', status,
    'createdAt', created_at
  )), '[]'::jsonb)
  into v_recent_invoices
  from (
    select
      i.id, i.invoice_number, i.customer_name, i.customer_region, i.grand_total, i.subtotal,
      i.cgst_amount, i.sgst_amount, i.igst_amount, i.status, i.created_at,
      s.name as store_name, s.code as store_code
    from public.invoices i
    join public.stores s on s.id = i.store_id
    where i.status <> 'void'
      and (v_date_filter is null or i.created_at >= v_date_filter)
      and (p_store_code = 'all' or s.code = p_store_code)
    order by i.created_at desc
    limit 10
  ) r;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'totalSales', v_total_sales,
      'totalSubtotal', v_total_subtotal,
      'netRevenue', v_net_revenue,
      'totalDiscount', v_total_discount,
      'cgstTotal', v_cgst_total,
      'sgstTotal', v_sgst_total,
      'totalGst', v_total_gst,
      'totalTax', v_total_gst,
      'totalInvoices', v_total_invoices,
      'invoiceCount', v_total_invoices,
      'averageTicket', v_average_ticket,
      'totalUnitsSold', v_total_units_sold,
      'unitsPerTransaction', v_units_per_tx,
      'totalCogs', v_total_cogs,
      'estimatedGrossProfit', v_est_gross_profit,
      'grossMarginPercent', v_gross_margin_pct,
      'netProfit', v_net_profit,
      'netMarginPercent', v_net_margin_pct,
      'totalInventoryValue', v_total_inventory_val,
      'potentialRetailValue', v_potential_retail_val,
      'unrealizedProfitInStock', v_unrealized_profit,
      'totalStockUnits', v_total_stock_units,
      'deadStockValue', v_dead_capital,
      'healthyInventoryPct', v_healthy_inv_pct,
      'totalSkusCount', v_total_skus,
      'healthySkusCount', v_healthy_skus,
      'lowStockSkusCount', v_low_stock_skus,
      'outOfStockSkusCount', v_out_of_stock_skus,
      'openingInvoice', v_opening_inv,
      'closingInvoice', v_closing_inv,
      'runRateDaily', v_run_rate_daily,
      'projectedMonthEndRevenue', v_proj_month_rev,
      'projectedMonthEndProfit', v_proj_month_profit,
      'stockoutRevenueAtRisk', v_stockout_rev_at_risk
    ),
    'thisMonthProfit', jsonb_build_object(
      'monthLabel', trim(to_char(v_now_ist, 'FMMonth YYYY')),
      'grossSales', v_m_gross_sales,
      'netRevenue', v_m_net_revenue,
      'cogs', v_m_cogs,
      'grossProfit', v_m_gross_profit,
      'cardMdrCost', v_m_card_mdr,
      'netProfit', v_m_net_profit,
      'marginPct', v_m_margin_pct,
      'billsCount', v_m_invoices
    ),
    'inventoryValuation', jsonb_build_object(
      'costValue', v_total_inventory_val,
      'retailValue', v_potential_retail_val,
      'expectedProfit', v_unrealized_profit,
      'totalUnits', v_total_stock_units,
      'activeSkus', v_total_skus,
      'healthySkus', v_healthy_skus,
      'lowStockSkus', v_low_stock_skus,
      'outOfStockSkus', v_out_of_stock_skus
    ),
    'salesVelocity', v_velocity_points,
    'lifetimeTimeline', jsonb_build_object(
      'months', v_lifetime_months,
      'totals', v_lifetime_totals
    ),
    'periodComparison', jsonb_build_object(
      'deltaPct', v_delta_pct,
      'prevNetRevenue', v_prev_net_revenue,
      'runRateDaily', v_run_rate_daily,
      'projectedMonthEndRevenue', v_proj_month_rev,
      'projectedMonthEndProfit', v_proj_month_profit,
      'daysInPeriod', v_window_days,
      'activeBillingDays', v_active_billing_days
    ),
    'payments', jsonb_build_object(
      'upi', v_upi,
      'card', v_card,
      'cash', v_cash,
      'emi', v_emi,
      'total', v_payments_sum,
      'estimatedCardMdrCost', v_card_mdr_cost,
      'cashVsEmi', jsonb_build_object(
        'cashPersons', v_cash_cnt,
        'emiPersons', v_emi_cnt,
        'upiPersons', v_upi_cnt,
        'cardPersons', v_card_cnt,
        'cashAvgTicket', case when v_cash_cnt > 0 then round(v_cash / v_cash_cnt) else 0 end,
        'emiAvgTicket', case when v_emi_cnt > 0 then round(v_emi / v_emi_cnt) else 0 end,
        'emiMultiplier', case when v_cash_cnt > 0 and v_emi_cnt > 0 and v_cash > 0 then round(((v_emi / v_emi_cnt) / (v_cash / v_cash_cnt))::numeric, 1) else null end,
        'highValueCashOpportunities', v_high_cash_opp_cnt,
        'highValueCashAmount', v_high_cash_opp_val
      ),
      'list', jsonb_build_array(
        jsonb_build_object(
          'method', 'cash',
          'label', 'Cash Register',
          'amount', v_cash,
          'personsCount', v_cash_cnt,
          'avgTicket', case when v_cash_cnt > 0 then round(v_cash / v_cash_cnt) else 0 end,
          'pct', round((v_cash / v_payments_sum) * 100),
          'feeRate', 'Direct Cash',
          'badgeColor', 'border-brand-gold-border text-brand-gold-text bg-brand-gold-subtle',
          'barColor', 'bg-brand-gold'
        ),
        jsonb_build_object(
          'method', 'emi',
          'label', 'Consumer EMI (Bajaj / TVS)',
          'amount', v_emi,
          'personsCount', v_emi_cnt,
          'avgTicket', case when v_emi_cnt > 0 then round(v_emi / v_emi_cnt) else 0 end,
          'pct', round((v_emi / v_payments_sum) * 100),
          'feeRate', 'Financier EMI',
          'badgeColor', 'border-accent/30 text-text bg-surface-subtle',
          'barColor', 'bg-accent'
        ),
        jsonb_build_object(
          'method', 'upi',
          'label', 'UPI / QR Transfer',
          'amount', v_upi,
          'personsCount', v_upi_cnt,
          'avgTicket', case when v_upi_cnt > 0 then round(v_upi / v_upi_cnt) else 0 end,
          'pct', round((v_upi / v_payments_sum) * 100),
          'feeRate', '0% MDR',
          'badgeColor', 'border-brand-sage-border text-brand-sage-text bg-brand-sage-subtle',
          'barColor', 'bg-brand-sage'
        ),
        jsonb_build_object(
          'method', 'card',
          'label', 'Debit & Credit Card',
          'amount', v_card,
          'personsCount', v_card_cnt,
          'avgTicket', case when v_card_cnt > 0 then round(v_card / v_card_cnt) else 0 end,
          'pct', round((v_card / v_payments_sum) * 100),
          'feeRate', '~1.8% MDR',
          'badgeColor', 'border-brand-crimson-border text-brand-crimson-text bg-brand-crimson-subtle',
          'barColor', 'bg-brand-crimson'
        )
      )
    ),
    'regions', v_regions,
    'branches', v_branches,
    'stores', v_stores_map,
    'categories', v_categories,
    'starProducts', v_star_products,
    'profitLevers', jsonb_build_object(
      'pendingReceivables', jsonb_build_object(
        'totalAmount', round(v_pending_receivables),
        'billsCount', v_pending_bills_cnt,
        'items', v_pending_items
      ),
      'deadStock', jsonb_build_object(
        'totalTrappedCapital', round(v_dead_capital),
        'count', v_dead_count,
        'items', v_dead_items
      ),
      'fastMoverRestocks', v_top_stockout_alerts,
      'attachRate', jsonb_build_object(
        'deviceBills', v_device_bills,
        'attachedBills', v_attached_bills,
        'attachRatePct', v_attach_rate_pct,
        'targetMonthlyGain', v_target_attach_gain
      ),
      'discountAudit', jsonb_build_object(
        'totalDiscount', round(v_total_discount),
        'discountedBillsCount', v_discounted_bills,
        'pctOfGrossProfit', case when v_est_gross_profit > 0 then round(((v_total_discount / v_est_gross_profit) * 100.0)::numeric, 1) else 0 end
      ),
      'emiUpsell', jsonb_build_object(
        'highValueCashOpportunities', v_high_cash_opp_cnt,
        'highValueCashAmount', round(v_high_cash_opp_val)
      )
    ),
    'businessActions', jsonb_build_object(
      'stockoutAlerts', v_top_stockout_alerts,
      'attachOpportunity', jsonb_build_object(
        'phoneRevenue', v_phone_rev,
        'accRevenue', v_acc_rev,
        'currentAttachRatio', v_attach_rate_pct,
        'targetAttachGain', v_target_attach_gain
      ),
      'deadCapital', jsonb_build_object(
        'totalTrappedCapital', round(v_dead_capital),
        'count', v_dead_count,
        'items', v_dead_items
      ),
      'mdrSavings', jsonb_build_object(
        'currentCost', v_card_mdr_cost,
        'potentialSavings', v_potential_mdr_savings
      )
    ),
    'recentInvoices', v_recent_invoices
  );
end;
$function$;
