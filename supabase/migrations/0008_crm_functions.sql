-- CRM RPC funksiyalari.

-- Partiya bo'yicha buyurtmalar soni yig'indisi (Firestore getAggregateFromServer(sum) o'rniga).
create function crm.sum_orders_product_count(p_lot_id text) returns numeric
language sql stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(o.product_count), 0) from crm.orders o where o.lot_id = p_lot_id;
$$;

revoke execute on function crm.sum_orders_product_count(text) from public, anon;
grant execute on function crm.sum_orders_product_count(text) to authenticated, service_role;

-- Bot: mijoz xabarini atomik yozish (chat konteyneri + xabar + unread_count + 1).
-- Faqat service_role (Edge Function).
create function crm.bot_append_customer_message(p_chat_id text, p_text text) returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  insert into crm.lead_chats as c (id, lead_id, last_message, last_timestamp, unread_count)
  values (p_chat_id, p_chat_id, p_text, v_now, 1)
  on conflict (id) do update set
    lead_id = excluded.lead_id,
    last_message = excluded.last_message,
    last_timestamp = excluded.last_timestamp,
    unread_count = c.unread_count + 1;

  insert into crm.lead_messages (chat_id, text, sender, timestamp)
  values (p_chat_id, p_text, 'customer', v_now);
end;
$$;

revoke execute on function crm.bot_append_customer_message(text, text) from public, anon, authenticated;
grant execute on function crm.bot_append_customer_message(text, text) to service_role;
