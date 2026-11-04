/** Reads a CSV file with a header row into one object per row. Handles quoted cells with commas, quotes and line breaks. */
export function readCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (quoted) throw new Error('The CSV file ends inside a quoted cell')
  if (cell || row.length) rows.push([...row, cell])

  const [header, ...lines] = rows
  return lines
    .filter((line) => line.some((value) => value !== ''))
    .map((line) => {
      if (line.length !== header.length) throw new Error(`A CSV row has ${line.length} cells instead of ${header.length}: ${line.join(',')}`)
      return Object.fromEntries(header.map((key, i) => [key, line[i]]))
    })
}
