import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface VNode {
  hash: bigint;
  nodeId: string;
}

interface HashRingProps {
  ringData: Record<string, string>;
  nodes: { ID: string; Address: string }[];
}

const HashRing: React.FC<HashRingProps> = ({ ringData = {}, nodes = [] }) => {
  const svgRef = useRef<SVGSVGElement>(null);

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

    // Gradient for lines
    const gradient = defs.append('linearGradient')
      .attr('id', 'line-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '100%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#6366f1');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#a855f7');

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

    // Draw lines from center to nodes
    vnodes.forEach(vn => {
      const angle = toAngle(vn.hash);
      const x = (radius - 10) * Math.cos(angle);
      const y = (radius - 10) * Math.sin(angle);
      
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', x).attr('y2', y)
        .attr('stroke', colors(vn.nodeId))
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.05);
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

    // Draw physical nodes labels
    nodes.forEach((node, i) => {
      const angle = ((i / nodes.length) * 360 - 90) * (Math.PI / 180);
      const lr = radius + 60;
      const x = lr * Math.cos(angle);
      const y = lr * Math.sin(angle);

      const ng = g.append('g').attr('transform', `translate(${x},${y})`);

      // Node ring
      ng.append('circle')
        .attr('r', 14)
        .attr('fill', 'rgba(0,0,0,0.5)')
        .attr('stroke', colors(node.ID))
        .attr('stroke-width', 2)
        .attr('class', 'filter glow-ring');

      // Pulsing center
      ng.append('circle')
        .attr('r', 4)
        .attr('fill', colors(node.ID))
        .append('animate')
        .attr('attributeName', 'opacity')
        .attr('values', '1;0.4;1')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite');

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

  }, [ringData, nodes]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative">
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
