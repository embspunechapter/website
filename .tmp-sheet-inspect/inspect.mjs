import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const path = process.argv[2];
const file = await FileBlob.load(path);
const workbook = await SpreadsheetFile.importXlsx(file);
const result = await workbook.inspect({ kind: "workbook,sheet,table", maxChars: 8000, tableMaxRows: 8, tableMaxCols: 30, tableMaxCellChars: 100 });
console.log(result.ndjson);