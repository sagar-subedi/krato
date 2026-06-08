export type EventType = 'gossip' | 'replication' | 'key_op' | 'node_status' | 'cluster_health';

export interface KratoEvent {
  type: EventType;
  node_id: string;
  timestamp: string;
  metadata: any;
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
