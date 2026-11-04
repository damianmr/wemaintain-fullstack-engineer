-- How do Meridian's three time bands show up in practice?
-- Findings: only item 65 (standby technician) has three different prices; 73
-- items share one price outside office hours. Past quotes mix office and
-- out-of-office prices, and label the band in their own words ("Night rate").
-- So the CSM picks the band on each line, from every band the list prints.
\ir 00-load-price-lists.sql

select count(*) as items,
  count(*) filter (where office = after_hours and after_hours = weekend) as one_price,
  count(*) filter (where office <> after_hours and after_hours = weekend) as office_or_not,
  count(*) filter (where office <> after_hours and after_hours <> weekend) as three_prices
from meridian;

select count(*) as lines,
  count(*) filter (where exists (select 1 from meridian m where l.unit_price = m.office and m.office <> m.after_hours)) as office_price,
  count(*) filter (where exists (select 1 from meridian m where l.unit_price = m.after_hours and m.office <> m.after_hours)) as out_of_office_price,
  count(*) filter (where l.text ~* 'office hour|after (office )?hour|overtime|public holiday|sunday|saturday|night') as names_a_band
from client_line l where l.account not ilike 'lindenhome%';

-- Standby hours (item 65 is SGD 111, 167, 222 per band).
select unit_price, count(*), sum(quantity) as hours
from client_line l
where l.account not ilike 'lindenhome%' and (l.unit_price in (111, 167, 222) or l.text ~* 'standby|man-?h')
group by 1 order by 2 desc;
