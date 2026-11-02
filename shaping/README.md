# Shaping C1: contract price lists in quoting

This folder holds the shaping of C1, "price lists as structured data in quoting,
for Lindenhome and Meridian".

- `analysis/`: the read-only queries behind the numbers we used to decide. Run
  them from the repository root against the seeded database, for example
  `psql postgres://wemaintain:wemaintain@127.0.0.1:5432/wemaintain -f shaping/analysis/01-what-quote-lines-contain.sql`.
