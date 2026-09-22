# Batchlight sample records

These are **synthetic** records for the fictional Ember & Oak sauce maker. They do not represent an actual food-safety incident, supplier, or customer.

Use a new empty workspace. Select `lots.csv`, `batches.csv`, and `shipments.csv` together; their order does not matter. You can also import lots first, then batches, then shipments. The `workspace.json` file contains all three arrays for a single atomic JSON import. Importing these records into the seeded demo correctly reports duplicate IDs; imports never replace existing records.

The three `friendly-*.csv` files contain the same example using codes instead of internal IDs, and readable `CODE:quantity` input cells. Choose either the original or friendly set, not both. Each set is complete on its own.

## CSV format

- Use UTF-8 `.csv` or `.json` files. Excel `.xlsx` files must be exported to CSV first. Imports are limited to 5 MB and 5,000 records in total.
- Exact headers work, and familiar aliases such as `Lot Code`, `Received Date`, `Qty`, `UOM`, and `Source Reference` are also accepted. Unknown columns produce warnings; their contents are not imported. Duplicate headers are rejected.
- IDs are stable links between files. An omitted ID defaults to the record's code, so supply a separate ID if your code contains spaces or other characters unsuitable for an ID. Lot and batch codes must be unique across both kinds of record.
- `receivedOn`, `producedOn`, `shippedOn`, and optional `expiresOn` use real calendar dates in `YYYY-MM-DD` format.
- Quantities must be positive, no greater than 1,000,000,000, with at most three decimal places.
- Supported units are `kg`, `g`, `l`, `ml`, and `units`.
- `batches.inputs` can be readable code-and-quantity pairs: `PAP-2409:3; TOM-1609:110; OIL-1509:5; VIN-1509:8`.
- Alternatively, `batches.inputs` can be a JSON array inside a correctly quoted CSV cell: `[{"sourceId":"lot-paprika-a","quantity":3}]`. `sourceCode` is also supported instead of `sourceId`.
- Input and shipment references can use imported or existing IDs/codes. All selected files are resolved together before the complete import is validated.
- Each input quantity is expressed in the **source record's unit**. There is no implicit conversion from grams to kilograms or litres to kilograms.
- A shipment quantity is expressed in its batch's output unit. Only production batches may be shipped.
- `recordsComplete` is `true` or `false` (case insensitive). Use `false` when any ingredient mapping is missing; do not invent a source ID or a zero quantity to fill the gap. `yes`, `no`, `1`, and `0` are rejected.
- `source` is required and records where the evidence came from, such as a delivery note number or production sheet.
- Lot status is `available` or `hold`; an omitted status defaults to `available`. `available` is an inventory status, not a food-safety guarantee.
- Full workspace JSON exports can be imported for their record arrays, but account information, workspace identity, revision numbers, and saved recall results are excluded with a warning.
- Formula-looking values are plain text and are never executed. A formula in a quantity field is invalid; replace it with the calculated numeric value before importing.

## Expected rehearsal

Trace `lot-paprika-a` / `PAP-2409`. The recorded chain reaches a 120 kg intermediate mother sauce and three finished batches totalling 480 jars: 300 shipped to three customers and 180 on hand. The intermediate kilograms are not added to jar counts.

The incomplete chilli-relish batch contains 120 jars and requires investigation, including its 48-jar shipment. Another 240-jar batch has no recorded connection to the selected paprika lot. That classification is based on the entered records; it does not establish product safety.

Quantities consumed by later batches and shipments are deducted from available stock. Inputs and outputs in different units are never added together as a physical mass balance. This tool does not verify recipes, yields, cross-contact, or actual contents of a container.
