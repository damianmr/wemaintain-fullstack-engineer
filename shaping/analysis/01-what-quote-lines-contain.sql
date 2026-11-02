-- What do past quotes for the two clients actually contain?
-- Finding: they are not only price-list lines. CSMs also quote hourly labour,
-- off-list parts with a coefficient, and list codes at another price.
-- So C1 needs manual lines next to contract lines.
\ir 00-load-price-lists.sql

-- Lindenhome AL, 2 November 2026: 271 lines; 93 cite a code at the list price,
-- 18 cite a code at another price, 28 are at an hourly labour price, 26 are off-list.
select
  count(*) as lines,
  count(*) filter (where exists (
    select 1 from lindenhome lh where l.text ~ lh.code and lh.price ~ '^[0-9.]+$' and abs(lh.price::numeric - l.unit_price) < 0.01
  )) as code_at_list_price,
  count(*) filter (where exists (select 1 from lindenhome lh where l.text ~ lh.code) and not exists (
    select 1 from lindenhome lh where l.text ~ lh.code and lh.price ~ '^[0-9.]+$' and abs(lh.price::numeric - l.unit_price) < 0.01
  )) as code_at_other_price,
  count(*) filter (where l.unit_price in (103.72, 108.97)) as hourly_labour_price,
  count(*) filter (where l.text ~* 'not (on|indicated in) (the )?price list|outside (the )?price list|coeff') as off_list_text
from client_line l
where l.account = 'Lindenhome AL';

-- Lines that cite a list code at another price (EUR 330 for 0430AS, EUR 1,922 for 0065AS, ...).
select (select string_agg(lh.code || '=' || lh.price, ' ') from lindenhome lh where l.text ~ lh.code) as listed,
  l.quantity, l.unit_price, left(l.text, 100) as text
from client_line l
where l.account = 'Lindenhome AL'
  and exists (select 1 from lindenhome lh where l.text ~ lh.code)
  and not exists (select 1 from lindenhome lh where l.text ~ lh.code and lh.price ~ '^[0-9.]+$' and abs(lh.price::numeric - l.unit_price) < 0.01);

-- Decimal quantities are almost absent (8 of about 25,300 lines, none for these
-- clients), so C1 accepts whole numbers only.
select count(*) as lines, count(*) filter (where quantity <> trunc(quantity)) as decimal_quantity from salesforce.quotelineitem;
select count(*) as repair_items, count(*) filter (where quantity <> trunc(quantity)) as decimal_quantity from workorders.work_order_item;
