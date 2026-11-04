# Shaping C1: contract price lists in quoting

This folder holds the shaping of C1, "price lists as structured data in quoting,
for Lindenhome and Meridian".

- `index.html`: the project description. Start here. Open it in a browser from
  a clone of this repository; GitHub shows only its source.

- `index.md`: the source of `index.html`, with the diagrams. After editing it,
  run `pnpm --filter shaping build` to build the page again.

- `analysis/`: the read-only queries behind the numbers we used to decide. Run
  them from the repository root against the seeded database, for example
  `psql postgres://wemaintain:wemaintain@127.0.0.1:5432/wemaintain -f shaping/analysis/01-what-quote-lines-contain.sql`.
