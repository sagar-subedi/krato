export type EventType = 'gossip' | 'replication' | 'key_op' | 'node_status' | 'cluster_health';

export interface KeyOpMetadata {
  op: 'read' | 'write' | 'delete';
  key: string;
  key_hash: string; // uint64 as string from JSON
  replica_nodes: string[];
  consistency: string;
  nodes: number;
  success: boolean;
}

export interface NodeStatusMetadata {
  node_id: string;
  status: string;
  latency: string;
  killed: boolean;
  ring_before?: Record<string, string>; // hash → nodeId
  ring_after?: Record<string, string>;
}

export interface KratoEvent {
  type: EventType;
  node_id: string;
  timestamp: string;
  metadata: KeyOpMetadata | NodeStatusMetadata | Record<string, any>;
}

export interface NodeInfo {
  ID: string;
  Address: string;
}

export interface Metrics {
  request_count: number;
  p50: number;
  p99: number;
  key_count: number;
  start_time: string;
  uptime: string;
}

export interface ClusterState {
  nodes: NodeInfo[];
  metrics: Metrics;
}

export interface RingSnapshot {
  [hash: string]: string;
}
