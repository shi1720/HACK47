import { useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import { Box, FlaskConical, Store, Wheat } from 'lucide-react';
import type { TraceResult, Workspace } from '../../shared/types';
import { number } from '../lib/api';
import '@xyflow/react/dist/style.css';
type Data = {
  title: string;
  code: string;
  subtitle: string;
  kind: 'lot' | 'batch' | 'shipment';
  state: string;
};
function TraceNode({ data }: NodeProps<Node<Data>>) {
  const Icon = data.kind === 'lot' ? Wheat : data.kind === 'batch' ? FlaskConical : Store;
  return (
    <div className={`trace-node ${data.state}`}>
      <Handle type="target" position={Position.Left} />
      <div className="trace-node-label">
        <Icon size={14} />
        <span>{data.code}</span>
        <i />
      </div>
      <strong>{data.title}</strong>
      <small>{data.subtitle}</small>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { trace: TraceNode };
export function TraceMap({
  workspace: w,
  result,
  onSelect,
}: {
  workspace: Workspace;
  result: TraceResult | null;
  onSelect: (id: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node<Data>[] = [],
      edges: Edge[] = [];
    const affected = new Set(result?.affectedBatchIds),
      investigate = new Set(result?.investigationBatchIds);
    const levels: Record<string, number> = {};
    const depth = (id: string, visited = new Set<string>()): number => {
      if (levels[id] !== undefined) return levels[id];
      if (visited.has(id)) return 0;
      visited.add(id);
      const batch = w.batches.find((b) => b.id === id);
      return (levels[id] = batch
        ? 1 + Math.max(0, ...batch.inputs.map((i) => depth(i.sourceId, new Set(visited))))
        : 0);
    };
    const rows: Record<number, number> = {};
    const pos = (level: number) => ({ x: level * 270, y: (rows[level] = (rows[level] || 0) + 1) * 116 });
    const state = (id: string) =>
      !result
        ? 'normal'
        : id === result.sourceId || affected.has(id)
          ? 'connected'
          : investigate.has(id)
            ? 'investigate'
            : 'unconnected';
    const selected = w.lots.find((l) => l.id === result?.sourceId);
    const other = w.lots.filter((l) => l.id !== selected?.id);
    for (const l of [...(selected ? [selected] : []), ...other])
      nodes.push({
        id: l.id,
        type: 'trace',
        position: pos(0),
        data: { title: l.name, code: l.code, subtitle: l.supplier, kind: 'lot', state: state(l.id) },
      });
    for (const b of w.batches) {
      nodes.push({
        id: b.id,
        type: 'trace',
        position: pos(depth(b.id)),
        data: {
          title: b.name,
          code: b.code,
          subtitle: `${number(b.quantity)} ${b.unit} · ${b.recordsComplete ? 'inputs recorded' : 'missing input record'}`,
          kind: 'batch',
          state: state(b.id),
        },
      });
      for (const input of b.inputs) {
        const active = result && (input.sourceId === result.sourceId || affected.has(input.sourceId));
        const uncertain = investigate.has(input.sourceId);
        edges.push({
          id: `${input.sourceId}-${b.id}`,
          source: input.sourceId,
          target: b.id,
          type: 'smoothstep',
          animated: Boolean(active),
          style: {
            stroke: active ? '#d56142' : uncertain ? '#c69237' : '#bec9c1',
            strokeWidth: active ? 2.2 : 1.2,
            strokeDasharray: uncertain ? '5 4' : undefined,
          },
        });
      }
    }
    const shipmentLevel = 1 + Math.max(1, ...w.batches.map((b) => depth(b.id)));
    for (const s of w.shipments) {
      const b = w.batches.find((b) => b.id === s.batchId);
      nodes.push({
        id: s.id,
        type: 'trace',
        position: pos(shipmentLevel),
        data: {
          title: s.customer,
          code: s.code,
          subtitle: `${number(s.quantity)} ${b?.unit || 'units'} · ${b?.code || ''}`,
          kind: 'shipment',
          state: state(s.batchId),
        },
      });
      edges.push({
        id: `${s.batchId}-${s.id}`,
        source: s.batchId,
        target: s.id,
        type: 'smoothstep',
        style: {
          stroke: affected.has(s.batchId) ? '#d56142' : investigate.has(s.batchId) ? '#c69237' : '#bec9c1',
          strokeWidth: affected.has(s.batchId) ? 2.2 : 1.2,
        },
      });
    }
    return { nodes, edges };
  }, [w, result]);
  return (
    <div className="trace-map">
      <div className="map-label">
        <Box size={13} /> Ingredient lots <span>Production batches</span>
        <span>Customer deliveries</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.16 }}
        minZoom={0.2}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => onSelect(node.id)}
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#ccd2c9" gap={18} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="map-hint">Select a record to inspect its evidence. Scroll to zoom.</div>
    </div>
  );
}
