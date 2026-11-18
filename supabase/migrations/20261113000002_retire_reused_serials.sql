-- Migration: 20261113000002_retire_reused_serials.sql
-- Description: Serial number lifecycle: unused ('in_stock') -> used ('sold') -> removed ('retired').
-- Billing an unused serial on any bill marks it used. Billing a used serial again on a cash bill
-- retires it, so it leaves both serial lists and can never be billed again. The unit row is kept
-- so past invoices, stock movements and returns still resolve it.
-- A return moves the serial back one step: retired -> sold, sold -> in_stock.
-- Requires 20261113000001_require_serials_and_cash_bill_reuse.sql.

-- 1. Allow the 'retired' unit status
alter table public.product_units drop constraint if exists product_units_status_check;
alter table public.product_units add constraint product_units_status_check
  check (status in ('in_stock', 'reserved', 'sold', 'retired', 'refurbishing', 'defective', 'returned'));

-- 2. place_sale: retire a used serial when it is billed again on a cash bill
create or replace function public.place_sale(
  p_store_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_gstin text,
  p_items jsonb,
  p_payments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  v_serial_number text;
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

  if (select count(*) from jsonb_array_elements(p_items) e where nullif(e->>'unit_id', '') is null) > 0 then
    raise exception 'Serial number is required for every billed item';
  end if;

  if (select count(distinct e->>'unit_id') from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then
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

    if coalesce(v_item.quantity, 1) <> 1 then
      raise exception 'Each serial number is billed as a single unit (quantity 1) for %', v_prod.name;
    end if;

    v_qty := 1;
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
    v_qty := 1;
    v_price := coalesce(v_item.unit_price, v_prod.selling_price);
    v_disc := coalesce(v_item.discount, 0);

    v_taxable := round((v_price - v_disc) * v_qty);
    v_item_cgst := round((v_taxable * (v_prod.gst_rate / 2.0) / 100.0));
    v_item_sgst := round((v_taxable * (v_prod.gst_rate / 2.0) / 100.0));
    v_item_total := v_taxable + v_item_cgst + v_item_sgst;

    select * into v_unit from public.product_units
    where id = v_item.unit_id
      and store_id = p_store_id
      and product_id = v_item.product_id
      and status in ('in_stock', 'sold')
    for update;

    if not found then
      raise exception 'Serial number for % is not available for billing', v_prod.name;
    end if;

    if v_unit.status = 'sold' and not v_is_cash_bill then
      raise exception 'Serial % has already been used. A used serial number can only be billed on a fully paid cash bill.', v_unit.serial_number;
    end if;

    v_serial_number := v_unit.serial_number;

    update public.product_units
    set status = case when v_unit.status = 'in_stock' then 'sold' else 'retired' end,
        updated_at = now()
    where id = v_item.unit_id;

    insert into public.order_items (
      invoice_id,
      product_id,
      unit_id,
      item_name,
      serial_number,
      hsn_code,
      quantity,
      unit_price,
      discount,
      taxable_value,
      gst_rate,
      cgst_amount,
      sgst_amount,
      total_amount
    ) values (
      v_invoice_id,
      v_item.product_id,
      v_item.unit_id,
      v_prod.name,
      v_serial_number,
      v_prod.hsn_code,
      v_qty,
      v_price,
      v_disc,
      v_taxable,
      v_prod.gst_rate,
      v_item_cgst,
      v_item_sgst,
      v_item_total
    );

    insert into public.stock_movements (
      store_id,
      product_id,
      unit_id,
      movement_type,
      quantity,
      cost_price,
      reference_id,
      created_by
    ) values (
      p_store_id,
      v_item.product_id,
      v_item.unit_id,
      'sale',
      -v_qty,
      v_prod.cost_price,
      v_invoice_num,
      (select auth.uid())
    );

    update public.inventory
    set quantity_on_hand = greatest(0, quantity_on_hand - v_qty),
        updated_at = now()
    where store_id = p_store_id and product_id = v_item.product_id;
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
          invoice_id,
          payment_method,
          amount,
          reference_number
        ) values (
          v_invoice_id,
          v_payment.payment_method,
          round(v_payment.amount),
          v_payment.reference_number
        );
      end if;
    end loop;
  end if;

  insert into public.audit_log (
    store_id,
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    p_store_id,
    (select auth.uid()),
    'create',
    'invoice',
    v_invoice_id::text,
    jsonb_build_object(
      'invoice_number', v_invoice_num,
      'grand_total', v_grand_total,
      'paid_amount', v_paid_total,
      'status', v_status,
      'cash_bill', v_is_cash_bill
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
$$;

grant execute on function public.place_sale(uuid, text, text, text, jsonb, jsonb) to anon, authenticated;

-- 3. process_return: a restocked serial moves back one step (retired -> sold, otherwise -> in_stock)
create or replace function public.process_return(
  p_invoice_id uuid,
  p_items jsonb,
  p_refund_amount numeric,
  p_refund_method text default 'cash',
  p_reason text default 'Customer Return',
  p_notes text default null,
  p_deduction_amount numeric default 0,
  p_deduction_reason text default null,
  p_gross_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv record;
  v_store_id uuid;
  v_item record;
  v_ret_num text;
  v_ret_id uuid;
  v_total_items integer := 0;
  v_returned_count integer := 0;
  v_deduction numeric(12, 2) := coalesce(p_deduction_amount, 0);
  v_gross numeric(12, 2);
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found';
  end if;
  v_store_id := v_inv.store_id;

  v_gross := coalesce(p_gross_amount, p_refund_amount + v_deduction);

  v_ret_num := 'RET-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 4);

  insert into public.sales_returns (
    store_id,
    invoice_id,
    return_number,
    customer_name,
    refund_amount,
    gross_amount,
    deduction_amount,
    deduction_reason,
    refund_method,
    reason,
    notes,
    items
  ) values (
    v_store_id,
    p_invoice_id,
    v_ret_num,
    v_inv.customer_name,
    p_refund_amount,
    v_gross,
    v_deduction,
    p_deduction_reason,
    p_refund_method,
    p_reason,
    p_notes,
    p_items
  ) returning id into v_ret_id;

  for v_item in select * from jsonb_to_recordset(p_items) as (
    order_item_id uuid,
    product_id uuid,
    unit_id uuid,
    quantity integer,
    restock boolean,
    condition text
  )
  loop
    if v_item.product_id is null and v_item.order_item_id is not null then
      select oi.product_id, coalesce(v_item.unit_id, oi.unit_id)
      into v_item.product_id, v_item.unit_id
      from public.order_items oi
      where oi.id = v_item.order_item_id;
    end if;

    if v_item.product_id is null then
      raise exception 'Product ID could not be identified for returned order item %', v_item.order_item_id;
    end if;

    if v_item.unit_id is not null then
      if coalesce(v_item.restock, true) = true then
        update public.product_units
        set status = case when status = 'retired' then 'sold' else 'in_stock' end,
            updated_at = now()
        where id = v_item.unit_id;

        update public.inventory
        set quantity_on_hand = quantity_on_hand + coalesce(v_item.quantity, 1),
            updated_at = now()
        where store_id = v_store_id and product_id = v_item.product_id;
      else
        update public.product_units
        set status = 'defective', updated_at = now()
        where id = v_item.unit_id;
      end if;

      insert into public.stock_movements (
        store_id,
        product_id,
        unit_id,
        movement_type,
        quantity,
        reference_id,
        created_by
      ) values (
        v_store_id,
        v_item.product_id,
        v_item.unit_id,
        'return',
        coalesce(v_item.quantity, 1),
        v_ret_num,
        (select auth.uid())
      );
    else
      if coalesce(v_item.restock, true) = true then
        update public.inventory
        set quantity_on_hand = quantity_on_hand + coalesce(v_item.quantity, 1),
            updated_at = now()
        where store_id = v_store_id and product_id = v_item.product_id;
      end if;

      insert into public.stock_movements (
        store_id,
        product_id,
        unit_id,
        movement_type,
        quantity,
        reference_id,
        created_by
      ) values (
        v_store_id,
        v_item.product_id,
        null,
        'return',
        coalesce(v_item.quantity, 1),
        v_ret_num,
        (select auth.uid())
      );
    end if;
  end loop;

  select count(*) into v_total_items from public.order_items where invoice_id = p_invoice_id;
  select count(*) into v_returned_count from jsonb_array_elements(p_items);

  if v_returned_count >= v_total_items then
    update public.invoices set status = 'returned' where id = p_invoice_id;
  else
    update public.invoices set status = 'partially_returned' where id = p_invoice_id;
  end if;

  insert into public.audit_log (
    store_id,
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    v_store_id,
    (select auth.uid()),
    'return',
    'invoice',
    p_invoice_id::text,
    jsonb_build_object(
      'return_number', v_ret_num,
      'refund_amount', p_refund_amount,
      'gross_amount', v_gross,
      'deduction_amount', v_deduction,
      'deduction_reason', p_deduction_reason,
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'return_id', v_ret_id,
    'return_number', v_ret_num,
    'invoice_id', p_invoice_id,
    'gross_amount', v_gross,
    'deduction_amount', v_deduction,
    'refund_amount', p_refund_amount
  );
end;
$$;
