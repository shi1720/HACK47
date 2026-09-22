import Papa from 'papaparse';
import { applyCommand, commandSchema, DomainError } from './domain';
import type { Batch, BatchInput, Lot, Shipment, Unit, Workspace } from './types';

export interface ImportFile {
  name: string;
  text: string;
}
export interface ImportPayload {
  lots: Lot[];
  batches: Batch[];
  shipments: Shipment[];
}
export interface ImportResult {
  payload: ImportPayload;
  warnings: string[];
}
type Kind = keyof ImportPayload;
type Location = { file: string; row: number; kind?: Kind };
type RawRecord = { kind: Kind; values: Record<string, unknown>; location: Location };
type StagedInput = { reference: string; quantity: number; preferCode: boolean };

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const columns: Record<Kind, string[]> = {
  lots: ['id', 'code', 'name', 'supplier', 'receivedOn', 'expiresOn', 'quantity', 'unit', 'status', 'source'],
  batches: [
    'id',
    'code',
    'name',
    'producedOn',
    'quantity',
    'unit',
    'inputs',
    'recordsComplete',
    'notes',
    'source',
  ],
  shipments: ['id', 'code', 'batchId', 'customer', 'contact', 'quantity', 'shippedOn', 'source'],
};
const aliases: Record<string, string> = {
  id: 'id',
  recordid: 'id',
  code: 'code',
  lotcode: 'code',
  name: 'name',
  product: 'name',
  productname: 'name',
  ingredient: 'name',
  ingredientname: 'name',
  supplier: 'supplier',
  suppliername: 'supplier',
  vendor: 'supplier',
  receivedon: 'receivedOn',
  receiveddate: 'receivedOn',
  datereceived: 'receivedOn',
  expireson: 'expiresOn',
  expirydate: 'expiresOn',
  expirationdate: 'expiresOn',
  bestbefore: 'expiresOn',
  quantity: 'quantity',
  qty: 'quantity',
  amount: 'quantity',
  unit: 'unit',
  units: 'unit',
  uom: 'unit',
  status: 'status',
  source: 'source',
  reference: 'source',
  sourcereference: 'source',
  evidence: 'source',
  evidencereference: 'source',
  producedon: 'producedOn',
  produceddate: 'producedOn',
  productiondate: 'producedOn',
  dateproduced: 'producedOn',
  inputs: 'inputs',
  input: 'inputs',
  ingredients: 'inputs',
  recordscomplete: 'recordsComplete',
  complete: 'recordsComplete',
  completerecords: 'recordsComplete',
  notes: 'notes',
  note: 'notes',
  batchid: 'batchId',
  batch: 'batchId',
  customer: 'customer',
  customername: 'customer',
  recipient: 'customer',
  contact: 'contact',
  customercontact: 'contact',
  email: 'contact',
  shippedon: 'shippedOn',
  shipmentdate: 'shippedOn',
  shippeddate: 'shippedOn',
  dispatchdate: 'shippedOn',
};
const normalize = (value: string) =>
  value
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
const canonical = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('en-US');
const place = (location: Location) =>
  `${location.file}, ${location.kind ? `${location.kind} ` : ''}row ${location.row}`;
function fail(location: Location, message: string, code = 'IMPORT_ERROR'): never {
  throw new DomainError(`${place(location)}: ${message}`, code);
}

function detectKind(name: string, headers: string[], location: Location): Kind {
  const canonicalHeaders = headers.map((header) => aliases[normalize(header)] ?? normalize(header));
  const candidates: Kind[] = [];
  if (canonicalHeaders.includes('receivedOn')) candidates.push('lots');
  if (canonicalHeaders.includes('producedOn')) candidates.push('batches');
  if (canonicalHeaders.includes('shippedOn')) candidates.push('shipments');
  if (candidates.length === 0) {
    if (canonicalHeaders.includes('supplier')) candidates.push('lots');
    if (canonicalHeaders.includes('inputs') || canonicalHeaders.includes('recordsComplete'))
      candidates.push('batches');
    if (canonicalHeaders.includes('batchId') || canonicalHeaders.includes('customer'))
      candidates.push('shipments');
  }
  if (candidates.length > 1)
    fail(
      location,
      'Headers mix different record types. Put lots, batches and shipments in separate CSV files.',
    );
  const baseName = name
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
  const filenameKind: Kind | undefined = /(?:^|[\s_.-])lots?(?:$|[\s_.-])/.test(baseName)
    ? 'lots'
    : /(?:^|[\s_.-])batch(?:es)?(?:$|[\s_.-])/.test(baseName)
      ? 'batches'
      : /(?:^|[\s_.-])shipments?(?:$|[\s_.-])/.test(baseName)
        ? 'shipments'
        : undefined;
  if (filenameKind && candidates[0] && filenameKind !== candidates[0])
    fail(
      location,
      `The filename suggests ${filenameKind}, but its headers describe ${candidates[0]}. Rename the file or correct the headers.`,
    );
  const kind = candidates[0] ?? filenameKind;
  if (!kind)
    fail(
      location,
      'Cannot identify this CSV. Include receivedOn for lots, producedOn for batches, or shippedOn for shipments.',
    );
  return kind;
}

function headerKey(header: string, kind: Kind): string | undefined {
  const key = normalize(header);
  if (key === 'batchcode') return kind === 'shipments' ? 'batchId' : 'code';
  if (key === 'lotid' && kind === 'lots') return 'id';
  if (key === 'batchid' && kind === 'batches') return 'id';
  if (key === 'shipmentid' && kind === 'shipments') return 'id';
  if (key === 'shipmentcode' && kind === 'shipments') return 'code';
  const mapped = aliases[key];
  return mapped && columns[kind].includes(mapped) ? mapped : undefined;
}

function readText(
  values: Record<string, unknown>,
  key: string,
  location: Location,
  required = true,
  fallback = '',
): string {
  const value = values[key];
  if (value === undefined || value === null || value === '') {
    if (required) fail(location, `“${key}” is required.`);
    return fallback;
  }
  if (typeof value !== 'string') fail(location, `“${key}” must be text.`);
  const text = value.trim();
  if (!text && required) fail(location, `“${key}” is required.`);
  return text || fallback;
}

function readQuantity(value: unknown, location: Location, key = 'quantity'): number {
  const text = typeof value === 'string' ? value.trim() : value;
  if (typeof text === 'string' && !/^(?:\d+(?:\.\d{1,3})?|\.\d{1,3})$/.test(text))
    fail(
      location,
      `“${key}” must be a positive decimal with at most three decimal places. Do not use formulas, separators or exponents.`,
    );
  if (typeof text !== 'number' && typeof text !== 'string')
    fail(location, `“${key}” must be a positive number.`);
  const amount = typeof text === 'number' ? text : Number(text);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1_000_000_000 ||
    Number(amount.toFixed(3)) !== amount
  )
    fail(
      location,
      `“${key}” must be greater than zero, at most 1,000,000,000, and have at most three decimal places.`,
    );
  return amount;
}

function readBoolean(value: unknown, location: Location): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'false') return false;
  return fail(location, '“recordsComplete” must be true or false. Mark missing ingredient mappings false.');
}

function readInputs(value: unknown, location: Location): StagedInput[] {
  if (value === undefined || value === null || value === '') return [];
  let inputs: unknown = value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    if (!text.startsWith('[')) {
      return text.split(';').map((part, index) => {
        const separator = part.lastIndexOf(':');
        if (separator <= 0 || !part.slice(0, separator).trim())
          fail(location, `Input ${index + 1} must look like PAP-2409:2; use semicolons between inputs.`);
        return {
          reference: part.slice(0, separator).trim(),
          quantity: readQuantity(part.slice(separator + 1), location, `input ${index + 1} quantity`),
          preferCode: true,
        };
      });
    }
    try {
      inputs = JSON.parse(text);
    } catch {
      fail(location, '“inputs” contains invalid JSON. Use a JSON array or CODE:quantity; CODE:quantity.');
    }
  }
  if (!Array.isArray(inputs))
    fail(location, '“inputs” must be a JSON array or CODE:quantity; CODE:quantity.');
  if (inputs.length > 1000) fail(location, 'A batch may contain at most 1,000 inputs.');
  return inputs.map((input: unknown, index: number) => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      fail(location, `Input ${index + 1} must be an object with sourceId (or sourceCode) and quantity.`);
    const object = input as Record<string, unknown>;
    if (Object.keys(object).some((key) => !['sourceId', 'sourceCode', 'quantity'].includes(key)))
      fail(
        location,
        `Input ${index + 1} contains unsupported fields. Quantities always use the source record's unit; do not provide a unit override.`,
      );
    if ((object.sourceId !== undefined) === (object.sourceCode !== undefined))
      fail(location, `Input ${index + 1} must have exactly one of sourceId or sourceCode.`);
    return {
      reference: readText(object, object.sourceId !== undefined ? 'sourceId' : 'sourceCode', location),
      quantity: readQuantity(object.quantity, location, `input ${index + 1} quantity`),
      preferCode: object.sourceCode !== undefined,
    };
  });
}

function parseCSV(file: ImportFile, warnings: string[], append: (record: RawRecord) => void): void {
  let headers: string[] | undefined;
  let keys: Array<string | undefined> = [];
  let kind: Kind | undefined;
  let currentLine = 1;
  let cursor = 0;
  // Accept Windows, Unix, and mixed line endings (a common spreadsheet export).
  const text = file.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  Papa.parse<string[]>(text, {
    delimiter: ',',
    newline: '\n',
    dynamicTyping: false,
    skipEmptyLines: false,
    step(result) {
      const location: Location = { file: file.name, row: currentLine };
      const span = text.slice(cursor, result.meta.cursor);
      currentLine += (span.match(/\r\n|\n|\r/g) ?? []).length;
      cursor = result.meta.cursor;
      if (result.errors.length) fail(location, `Malformed CSV: ${result.errors[0].message}`);
      const cells = result.data;
      if (cells.every((cell) => cell.trim() === '')) return;
      if (!headers) {
        headers = cells.map((cell) => cell.trim());
        if (headers.some((header) => !header))
          fail(location, 'Every column needs a nonempty header. Remove trailing empty columns.');
        kind = detectKind(file.name, headers, location);
        keys = headers.map((header) => headerKey(header, kind!));
        const seen = new Set<string>();
        headers.forEach((header, index) => {
          const normalized = keys[index] ?? normalize(header);
          if (seen.has(normalized))
            fail(
              location,
              `Duplicate header “${header}”. Aliases such as qty and quantity also count as duplicates.`,
            );
          seen.add(normalized);
          if (!keys[index])
            warnings.push(
              `${place(location)}: column “${header}” is not imported. Keep the original file if you need this data.`,
            );
        });
        return;
      }
      if (cells.length !== headers.length)
        fail(
          location,
          `Expected ${headers.length} columns but found ${cells.length}. Quote any cells containing commas.`,
        );
      const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      keys.forEach((key, index) => {
        if (key) values[key] = cells[index];
      });
      append({ kind: kind!, values, location });
    },
  });
  if (!headers) fail({ file: file.name, row: 1 }, 'The CSV file is empty.');
}

function parseJSON(file: ImportFile, warnings: string[], append: (record: RawRecord) => void): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.text.replace(/^\uFEFF/, ''));
  } catch {
    fail(
      { file: file.name, row: 1 },
      'Invalid JSON. Export a valid workspace or an object containing lots, batches and shipments.',
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    fail(
      { file: file.name, row: 1 },
      'JSON must be a workspace object containing lots, batches and shipments arrays.',
    );
  const object = parsed as Record<string, unknown>;
  const ignored = Object.keys(object).filter((key) => !['lots', 'batches', 'shipments'].includes(key));
  if (ignored.length)
    warnings.push(
      `${file.name}: top-level fields ${ignored.map((key) => `“${key}”`).join(', ')} are excluded. Account settings, revisions and saved recalls are never imported.`,
    );
  for (const kind of ['lots', 'batches', 'shipments'] as const) {
    if (object[kind] === undefined) continue;
    if (!Array.isArray(object[kind])) fail({ file: file.name, row: 1, kind }, `“${kind}” must be an array.`);
    for (let index = 0; index < object[kind].length; index++) {
      const location: Location = { file: file.name, row: index + 1, kind };
      const row: unknown = object[kind][index];
      if (!row || typeof row !== 'object' || Array.isArray(row))
        fail(location, 'Each record must be an object.');
      const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const [key, value] of Object.entries(row)) {
        if (!columns[kind].includes(key))
          warnings.push(
            `${place(location)}: field “${key}” is not imported. Keep the original file if you need this data.`,
          );
        else values[key] = value;
      }
      append({ kind, values, location });
    }
  }
}

/** Parse and validate a complete additive import without changing the existing workspace. */
export function parseImport(files: ImportFile[], existing: Workspace): ImportResult {
  if (!Array.isArray(files) || files.length === 0)
    throw new DomainError('Choose at least one CSV or JSON file.', 'IMPORT_ERROR');
  if (files.length > 50) throw new DomainError('Import at most 50 files at once.', 'IMPORT_LIMIT');
  const warnings: string[] = [];
  const rows: RawRecord[] = [];
  let bytes = 0;
  const append = (record: RawRecord) => {
    if (rows.length >= MAX_ROWS)
      fail(record.location, 'An import may contain at most 5,000 records across all files.', 'IMPORT_LIMIT');
    rows.push(record);
  };
  for (const file of files) {
    if (!file || typeof file.name !== 'string' || typeof file.text !== 'string')
      throw new DomainError('Each import needs a filename and text contents.', 'IMPORT_ERROR');
    bytes += new TextEncoder().encode(file.text).byteLength;
    if (bytes > MAX_BYTES)
      fail({ file: file.name, row: 1 }, 'Import files must total no more than 5 MB.', 'IMPORT_LIMIT');
    if (/\.json$/i.test(file.name)) parseJSON(file, warnings, append);
    else if (/\.csv$/i.test(file.name)) parseCSV(file, warnings, append);
    else
      fail(
        { file: file.name, row: 1 },
        'Unsupported file type. Use .csv or .json; export Excel workbooks to CSV first.',
      );
  }
  if (!rows.length)
    throw new DomainError(
      `${files.map((file) => file.name).join(', ')}, row 1: No lot, batch or shipment records were found.`,
      'IMPORT_ERROR',
    );

  const payload: ImportPayload = { lots: [], batches: [], shipments: [] };
  const locations: Record<Kind, Location[]> = { lots: [], batches: [], shipments: [] };
  const unresolved = new Map<Batch, StagedInput[]>();
  for (const { kind, values, location } of rows) {
    const common = {
      code: readText(values, 'code', location),
      id: readText(values, 'id', location, false, readText(values, 'code', location)),
      quantity: readQuantity(values.quantity, location),
      source: readText(values, 'source', location),
    };
    locations[kind].push(location);
    if (kind === 'lots') {
      const expiresOn = readText(values, 'expiresOn', location, false);
      payload.lots.push({
        ...common,
        name: readText(values, 'name', location),
        supplier: readText(values, 'supplier', location),
        receivedOn: readText(values, 'receivedOn', location),
        ...(expiresOn ? { expiresOn } : {}),
        unit: readText(values, 'unit', location).toLowerCase() as Unit,
        status: readText(values, 'status', location, false, 'available').toLowerCase() as Lot['status'],
      });
    } else if (kind === 'batches') {
      const record: Batch = {
        ...common,
        name: readText(values, 'name', location),
        producedOn: readText(values, 'producedOn', location),
        unit: readText(values, 'unit', location).toLowerCase() as Unit,
        inputs: [],
        recordsComplete: readBoolean(values.recordsComplete, location),
        notes: readText(values, 'notes', location, false),
      };
      unresolved.set(record, readInputs(values.inputs, location));
      payload.batches.push(record);
    } else {
      payload.shipments.push({
        ...common,
        batchId: readText(values, 'batchId', location),
        customer: readText(values, 'customer', location),
        contact: readText(values, 'contact', location, false),
        shippedOn: readText(values, 'shippedOn', location),
      });
    }
  }

  const allSources = [...existing.lots, ...existing.batches, ...payload.lots, ...payload.batches];
  const sourcesById = new Map<string, Lot | Batch>();
  const sourcesByCode = new Map<string, Lot | Batch>();
  const importedSourceLocations = new Map<string, Location>();
  payload.lots.forEach((record, index) => importedSourceLocations.set(record.id, locations.lots[index]));
  payload.batches.forEach((record, index) =>
    importedSourceLocations.set(record.id, locations.batches[index]),
  );
  for (const record of allSources) {
    const location = importedSourceLocations.get(record.id);
    if (sourcesById.has(record.id) && location)
      fail(
        location,
        `ID “${record.id}” already exists. Imports add records and never overwrite them.`,
        'DUPLICATE_ID',
      );
    if (sourcesByCode.has(canonical(record.code)) && location)
      fail(location, `Lot or batch code “${record.code}” already exists.`, 'DUPLICATE_CODE');
    sourcesById.set(record.id, record);
    sourcesByCode.set(canonical(record.code), record);
  }
  const resolve = (reference: string, location: Location, preferCode = false): Lot | Batch => {
    const byId = sourcesById.get(reference);
    const byCode = sourcesByCode.get(canonical(reference));
    const record = preferCode ? (byCode ?? byId) : (byId ?? byCode);
    if (!record)
      fail(
        location,
        `Source “${reference}” does not exist. Include its lot or batch in this import, or use an existing ID/code.`,
        'MISSING_SOURCE',
      );
    return record;
  };
  payload.batches.forEach((record, index) => {
    record.inputs = unresolved
      .get(record)!
      .map(
        (input): BatchInput => ({
          sourceId: resolve(input.reference, locations.batches[index], input.preferCode).id,
          quantity: input.quantity,
        }),
      );
  });
  payload.shipments.forEach((record, index) => {
    const source = resolve(record.batchId, locations.shipments[index]);
    if (!('producedOn' in source))
      fail(
        locations.shipments[index],
        `“${record.batchId}” is an ingredient lot. Shipments must reference a production batch.`,
        'MISSING_BATCH',
      );
    record.batchId = source.id;
  });

  const command = { type: 'workspace.import' as const, payload };
  const schemaResult = commandSchema.safeParse(command);
  if (!schemaResult.success) {
    const issue = schemaResult.error.issues[0];
    const kind = issue.path[1] as Kind;
    const index = issue.path[2];
    const location = typeof index === 'number' ? locations[kind]?.[index] : undefined;
    fail(location ?? rows[0].location, `${issue.path.slice(3).join('.') || 'Record'}: ${issue.message}`);
  }
  try {
    applyCommand(existing, command);
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    // Graph errors may span files. Point to a named record where possible, otherwise
    // give an honest record range rather than claiming a single row caused the conflict.
    const subject = rows.find((row) => {
      const code = typeof row.values.code === 'string' ? row.values.code.trim() : '';
      return (
        code &&
        [
          `${code}:`,
          `Lot ${code}:`,
          `Batch ${code}:`,
          `Batch ${code} `,
          `Shipment ${code}:`,
          `Shipment ${code} `,
        ].some((prefix) => error.message.startsWith(prefix))
      );
    });
    const named =
      subject ??
      rows.find((row) => {
        const code = typeof row.values.code === 'string' ? row.values.code.trim() : '';
        const recordId = typeof row.values.id === 'string' ? row.values.id.trim() : code;
        return (
          (code &&
            (error.message.startsWith(`${code}:`) ||
              error.message.includes(` ${code}:`) ||
              error.message.includes(`“${code}”`) ||
              error.message.includes(` ${code} `))) ||
          (recordId && error.message.includes(`“${recordId}”`))
        );
      });
    if (named) fail(named.location, error.message, error.code);
    const ranges = [...new Set(rows.map((row) => row.location.file))].map((file) => {
      const matching = rows.filter((row) => row.location.file === file);
      return `${file}, rows ${Math.min(...matching.map((row) => row.location.row))}–${Math.max(...matching.map((row) => row.location.row))}`;
    });
    throw new DomainError(`${ranges.join('; ')}: ${error.message}`, error.code);
  }
  return { payload, warnings };
}
