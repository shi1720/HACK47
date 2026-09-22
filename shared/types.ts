export type Unit = 'kg' | 'g' | 'l' | 'ml' | 'units';
export interface Lot {
  id: string;
  code: string;
  name: string;
  supplier: string;
  receivedOn: string;
  expiresOn?: string;
  quantity: number;
  unit: Unit;
  status: 'available' | 'hold';
  source: string;
}
export interface BatchInput {
  sourceId: string;
  quantity: number;
}
export interface Batch {
  id: string;
  code: string;
  name: string;
  producedOn: string;
  quantity: number;
  unit: Unit;
  inputs: BatchInput[];
  recordsComplete: boolean;
  notes: string;
  source: string;
}
export interface Shipment {
  id: string;
  code: string;
  batchId: string;
  customer: string;
  contact: string;
  quantity: number;
  shippedOn: string;
  source: string;
}
export interface TraceGap {
  batchId: string;
  message: string;
}
export interface TraceResult {
  sourceId: string;
  affectedBatchIds: string[];
  investigationBatchIds: string[];
  unconnectedBatchIds: string[];
  shipmentIds: string[];
  investigationShipmentIds: string[];
  paths: Record<string, string[]>;
  affectedUnits: number;
  shippedUnits: number;
  onHandUnits: number;
  customerCount: number;
  gaps: TraceGap[];
  computedAt: string;
}
export interface Recall {
  id: string;
  title: string;
  reason: string;
  sourceId: string;
  createdAt: string;
  status: 'open' | 'closed';
  mode: 'drill' | 'incident';
  result: TraceResult;
  snapshot: { lots: Lot[]; batches: Batch[]; shipments: Shipment[] };
}
export interface Workspace {
  id: string;
  name: string;
  revision: number;
  lots: Lot[];
  batches: Batch[];
  shipments: Shipment[];
  recalls: Recall[];
}
export interface User {
  id: string;
  name: string;
  email: string;
  isDemo: boolean;
}
export interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  detail: string;
  revision: number;
  hash: string;
  previousHash: string;
}
export type Command =
  | { type: 'lot.create'; payload: Lot }
  | { type: 'lot.status'; payload: { id: string; status: 'available' | 'hold' } }
  | { type: 'batch.create'; payload: Batch }
  | {
      type: 'batch.resolve';
      payload: { id: string; additionalInputs: BatchInput[]; notes: string; source: string };
    }
  | { type: 'shipment.create'; payload: Shipment }
  | {
      type: 'recall.create';
      payload: { id: string; sourceId: string; title: string; reason: string; mode: 'drill' | 'incident' };
    }
  | { type: 'recall.close'; payload: { id: string } }
  | { type: 'workspace.rename'; payload: { name: string } }
  | { type: 'workspace.import'; payload: { lots: Lot[]; batches: Batch[]; shipments: Shipment[] } };
export interface QueuedCommand {
  id: string;
  command: Command;
  createdAt: string;
  baseRevision: number;
}
export interface SessionResponse {
  user: User;
  workspace: Workspace;
  csrfToken: string;
  recoveryCode?: string;
}
