import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { KratoEvent, KeyOpMetadata, NodeStatusMetadata } from '../types';

interface VNode {
  hash: bigint;
  nodeId: string;
}

interface HashRingProps {
  ringData: Record<string, string>;
  nodes: { ID: string; Address: string }[];
  activeOp?: KratoEvent | null;
  nodeEvent?: KratoEvent | null;
}

const HashRing: React.FC<HashRingProps> = ({ ringData = {}, nodes = [], activeOp, nodeEvent }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 600;
    const height = 600;
    const radius = 220;
    const cx = width / 2;
    const cy = height / 2;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    
    // Glow Filter
    const glow = defs.append('filter').attr('id', 'glow-ring');
    glow.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    const feMerge = glow.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // Decorative outer rings
    [radius + 40, radius + 10, radius - 10].forEach((r, i) => {
      g.append('circle')
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255, 255, 255, 0.03)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', i === 0 ? '5 15' : 'none');
    });

    const MAX_HASH = BigInt('18446744073709551615');
    const colors = d3.scaleOrdinal<string>(['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']);

    const vnodes: VNode[] = Object.entries(ringData)
      .map(([hash, nodeId]) => ({ hash: BigInt(hash), nodeId }))
      .sort((a, b) => (a.hash < b.hash ? -1 : 1));

    const toAngle = (hash: bigint) =>
      (Number((hash * BigInt(3600000)) / MAX_HASH) / 10 - 90) * (Math.PI / 180);

    // Draw lines from center to nodes (subtle support)
    vnodes.forEach(vn => {
      const angle = toAngle(vn.hash);
      const x = (radius - 10) * Math.cos(angle);
      const y = (radius - 10) * Math.sin(angle);
      
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', x).attr('y2', y)
        .attr('stroke', colors(vn.nodeId))
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.03);
    });

    // Draw vnode dots
    g.selectAll('.vnode')
      .data(vnodes)
      .enter()
      .append('circle')
      .attr('class', 'vnode')
      .attr('cx', vn => radius * Math.cos(toAngle(vn.hash)))
      .attr('cy', vn => radius * Math.sin(toAngle(vn.hash)))
      .attr('r', 2)
      .attr('fill', vn => colors(vn.nodeId))
      .attr('opacity', 0.6);

    // Draw physical nodes
    const nodePositions: Record<string, { x: number, y: number, angle: number }> = {};
    nodes.forEach((node, i) => {
      const angle = ((i / nodes.length) * 360 - 90) * (Math.PI / 180);
      const lr = radius + 60;
      const x = lr * Math.cos(angle);
      const y = lr * Math.sin(angle);
      nodePositions[node.ID] = { x, y, angle };

      const ng = g.append('g').attr('transform', `translate(${x},${y})`).attr('id', `node-group-${node.ID}`);

      ng.append('circle')
        .attr('r', 14)
        .attr('fill', 'rgba(0,0,0,0.5)')
        .attr('stroke', colors(node.ID))
        .attr('stroke-width', 2)
        .attr('class', 'glow-ring');

      ng.append('circle')
        .attr('r', 4)
        .attr('fill', colors(node.ID))
        .attr('class', 'status-dot');

      ng.append('text')
        .attr('dy', 34)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ffffff')
        .attr('font-size', '10px')
        .attr('font-family', 'Outfit')
        .attr('font-weight', 'bold')
        .text(node.ID);
    });

    // Center Display
    const centerG = g.append('g');
    centerG.append('circle')
      .attr('r', 60)
      .attr('fill', 'rgba(255,255,255,0.02)')
      .attr('stroke', 'rgba(255,255,255,0.05)');

    centerG.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-5px')
      .attr('fill', 'white')
      .attr('font-size', '16px')
      .attr('font-family', 'Outfit')
      .attr('font-weight', 'bold')
      .text(vnodes.length);

    centerG.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '15px')
      .attr('fill', 'var(--color-text-dim)')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .attr('letter-spacing', '2px')
      .text('TOTAL VNODES');

    // ANIMATION: Key Placement (Pulse + Arcs)
    if (activeOp && activeOp.type === 'key_op') {
      const meta = activeOp.metadata as KeyOpMetadata;
      const hashPos = BigInt(meta.key_hash);
      const angle = toAngle(hashPos);
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      const opColor = meta.op === 'write' ? '#6366f1' : meta.op === 'delete' ? '#ef4444' : '#10b981';

      // 1. Central Pulse
      const pulse = g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 2)
        .attr('fill', opColor)
        .attr('filter', 'url(#glow-ring)');

      pulse.transition()
        .duration(600)
        .attr('r', 12)
        .style('opacity', 0)
        .remove();

      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 4)
        .attr('fill', opColor)
        .transition()
        .delay(2000)
        .duration(500)
        .style('opacity', 0)
        .remove();

      // Label
      g.append('text')
        .attr('x', x)
        .attr('y', y - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'JetBrains Mono')
        .text(meta.key)
        .transition()
        .delay(2000)
        .duration(500)
        .style('opacity', 0)
        .remove();

      // 2. Replica Arcs
      meta.replica_nodes.forEach((nodeId, i) => {
        const dest = nodePositions[nodeId];
        if (!dest) return;

        const pathData = d3.path();
        pathData.moveTo(x, y);
        // Curve toward the physical node
        pathData.quadraticCurveTo(x * 1.2, y * 1.2, dest.x, dest.y);

        const arc = g.append('path')
          .attr('d', pathData.toString())
          .attr('fill', 'none')
          .attr('stroke', opColor)
          .attr('stroke-width', 2)
          .attr('opacity', 0.4)
          .attr('stroke-dasharray', function() { return (this as SVGPathElement).getTotalLength(); })
          .attr('stroke-dashoffset', function() { return (this as SVGPathElement).getTotalLength(); });

        arc.transition()
          .delay(i * 100)
          .duration(800)
          .attr('stroke-dashoffset', 0)
          .transition()
          .delay(1000)
          .duration(500)
          .style('opacity', 0)
          .remove();

        // Highlight the node
        d3.select(`#node-group-${nodeId} .glow-ring`)
          .transition()
          .delay(i * 100 + 400)
          .duration(300)
          .attr('stroke-width', 6)
          .transition()
          .duration(300)
          .attr('stroke-width', 2);
      });
    }

    // ANIMATION: Node Redistribution (Isolation)
    if (nodeEvent && nodeEvent.type === 'node_status') {
      const meta = nodeEvent.metadata as NodeStatusMetadata;
      if (meta.killed && meta.ring_before) {
        const ringBefore = meta.ring_before;
        const ringAfter = ringData; // use latest prop
        const deadNode = meta.node_id;

        // Find vnodes that transitioned from deadNode to something else
        Object.entries(ringBefore).forEach(([hashStr, nodeId]) => {
          if (nodeId === deadNode) {
            const hashVal = BigInt(hashStr);
            const newNodeId = ringAfter[hashStr];
            if (newNodeId && newNodeId !== deadNode) {
              // Animate flow to new successor
              const startAngle = toAngle(hashVal);
              const endNode = nodePositions[newNodeId];
              if (!endNode) return;

              const flowDot = g.append('circle')
                .attr('cx', radius * Math.cos(startAngle))
                .attr('cy', radius * Math.sin(startAngle))
                .attr('r', 3)
                .attr('fill', colors(newNodeId))
                .attr('filter', 'url(#glow-ring)');

              flowDot.transition()
                .duration(1500)
                .ease(d3.easeCubicInOut)
                .attr('cx', endNode.x)
                .attr('cy', endNode.y)
                .style('opacity', 0)
                .remove();
            }
          }
        });

        // Pulse the successors
        d3.selectAll('.glow-ring')
          .transition()
          .delay(1000)
          .duration(500)
          .attr('stroke', '#10b981')
          .transition()
          .duration(500)
          .attr('stroke', d => colors(d as any));
      }
    }

  }, [ringData, nodes, activeOp, nodeEvent]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center relative">
      <svg
        ref={svgRef}
        width="600"
        height="600"
        viewBox="0 0 600 600"
        className="max-w-full h-auto drop-shadow-2xl"
      />
    </div>
  );
};

export default HashRing;
