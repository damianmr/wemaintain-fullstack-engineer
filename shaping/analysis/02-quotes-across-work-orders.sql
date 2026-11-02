-- How often does one quote cover several work orders?
-- Finding: often (39 of 106 Lindenhome AL quotes, up to 10 work orders; 22 of 49
-- Meridian-group quotes), and across buildings for Lindenhome. So the unit of
-- work is a quote draft that holds several work orders, not one work order.

with client_work_order as (
  select w."sfQuoteId" as quote_id, w."deviceId" as device_id, d."buildingId" as building_id,
    case when c."companyName" ilike 'lindenhome al' then 'Lindenhome AL' else 'Meridian group' end as client
  from workorders.work_order w
  join devices.device d on d.id = w."deviceId"
  join buildings.building b on b.id = d."buildingId"
  join users.customer c on c.id = b."customerId"
  where w."sfQuoteId" is not null
    and c."companyName" ilike any (array['lindenhome al', '%meridian%', '%serava%', '%mr retail%'])
),
per_quote as (
  select client, quote_id, count(*) as work_orders, count(distinct device_id) as devices, count(distinct building_id) as buildings
  from client_work_order group by 1, 2
)
select client, count(*) as quotes, count(*) filter (where work_orders > 1) as several_work_orders,
  max(work_orders) as most_work_orders,
  count(*) filter (where work_orders > 1 and buildings > 1) as several_buildings
from per_quote group by 1 order by 1;

-- Example: quote 00032036, three work orders in three buildings, one 0435AS line x 4.
select w."workOrderNumber", d."deviceNo", b."buildingName", i.quantity, p.name as part
from workorders.work_order w
join devices.device d on d.id = w."deviceId"
join buildings.building b on b.id = d."buildingId"
join workorders.work_order_item i on i."workOrderId" = w.id
left join workorders.part p on p.id = i."partId"
where w."quoteNumber" = '00032036';
