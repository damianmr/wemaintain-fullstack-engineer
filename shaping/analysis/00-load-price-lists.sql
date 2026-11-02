-- Loads the two contract price lists into temporary tables, so the other
-- queries can compare past quote lines with them. Included by the other files.
-- Run every file from the repository root: \copy paths are relative to it.

create temp table lindenhome (
  code text, section text, designation text, unit text, price text,
  supply_lead_time_weeks text, works_duration_weeks text, technical_reference text, comment text
);
\copy lindenhome from 'exploration/price-lists/lindenhome-price-list.csv' csv header

create temp table meridian (no text, description text, uom text, office numeric, after_hours numeric, weekend numeric);
\copy meridian from 'exploration/price-lists/meridian-sor-table-a.csv' csv header

-- Every Salesforce quote line of the two clients, with its text in one column.
create temp view client_line as
select l.id, l.quoteid as quote_id, l.quantity, l.unitprice as unit_price, a.name as account,
  regexp_replace(coalesce(p.name, '') || ' | ' || coalesce(l.quotepdf_productname__c, '') || ' | ' || coalesce(l.quote_line_description__c, ''), '\s+', ' ', 'g') as text
from salesforce.quotelineitem l
join salesforce.quote q on q.id = l.quoteid
join salesforce.account a on a.id = q.accountid
left join salesforce.product2 p on p.id = l.product2id
where a.name ilike any (array['lindenhome al', '%meridian%', '%serava%', '%mr retail%']);
