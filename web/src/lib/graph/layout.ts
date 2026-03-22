/**
 * Graph Layout - DAG auto-layout algorithm
 *
 * Provides automatic layout for workflow graphs using a simple
 * layered directed graph layout algorithm (Sugiyama-style).
 */

export interface LayoutNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutOptions {
  /** Horizontal gap between nodes (default: 80) */
  nodeGapX?: number;
  /** Vertical gap between nodes (default: 60) */
  nodeGapY?: number;
  /** Left margin (default: 50) */
  marginX?: number;
  /** Top margin (default: 50) */
  marginY?: number;
  /** Node width (default: 200) */
  nodeWidth?: number;
  /** Node height (default: 80) */
  nodeHeight?: number;
  /** Layout direction: 'LR' (left-to-right) or 'TB' (top-to-bottom) (default: 'LR') */
  direction?: 'LR' | 'TB';
}

/**
 * Simple DAG layout algorithm
 *
 * This is a basic implementation that:
 * 1. Finds the longest path through the DAG to determine layers
 * 2. Assigns nodes to layers based on their position in the execution order
 * 3. Positions nodes with horizontal spacing based on layer
 */
export function layoutDAG<T extends LayoutNode>(
  nodes: T[],
  edges: LayoutEdge[],
  options: LayoutOptions = {}
): Map<string, { x: number; y: number }> {
  const {
    nodeGapX = 80,
    nodeGapY = 60,
    marginX = 50,
    marginY = 50,
    nodeWidth = 200,
    nodeHeight = 80,
    direction = 'LR',
  } = options;

  // Build adjacency lists
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const node of nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  for (const edge of edges) {
    outgoing.get(edge.source)?.push(edge.target);
    incoming.get(edge.target)?.push(edge.source);
  }

  // Find root nodes (no incoming edges)
  const roots = nodes.filter((n) => (incoming.get(n.id)?.length ?? 0) === 0);

  // If no roots, use first node
  if (roots.length === 0 && nodes.length > 0) {
    roots.push(nodes[0]);
  }

  // Assign layers using BFS from roots
  const layers = new Map<string, number>();
  const queue: string[] = [...roots.map(n => n.id)];
  const visited = new Set<string>();

  for (const root of roots) {
    layers.set(root.id, 0);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const currentLayer = layers.get(nodeId) ?? 0;

    for (const neighbor of outgoing.get(nodeId) ?? []) {
      const neighborLayer = (layers.get(neighbor) ?? currentLayer + 1);
      layers.set(neighbor, Math.max(neighborLayer, currentLayer + 1));

      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  // Handle disconnected nodes
  for (const node of nodes) {
    if (!layers.has(node.id)) {
      layers.set(node.id, 0);
    }
  }

  // Group nodes by layer
  const layerGroups = new Map<number, string[]>();
  for (const [nodeId, layer] of layers) {
    const group = layerGroups.get(layer) ?? [];
    group.push(nodeId);
    layerGroups.set(layer, group);
  }

  // Sort layers
  const sortedLayers = [...layerGroups.keys()].sort((a, b) => a - b);

  // Calculate positions
  const positions = new Map<string, { x: number; y: number }>();

  for (const layer of sortedLayers) {
    const nodesInLayer = layerGroups.get(layer) ?? [];

    for (let i = 0; i < nodesInLayer.length; i++) {
      const nodeId = nodesInLayer[i];

      if (direction === 'LR') {
        // Left-to-right layout
        positions.set(nodeId, {
          x: marginX + layer * (nodeWidth + nodeGapX),
          y: marginY + i * (nodeHeight + nodeGapY),
        });
      } else {
        // Top-to-bottom layout
        positions.set(nodeId, {
          x: marginX + i * (nodeWidth + nodeGapX),
          y: marginY + layer * (nodeHeight + nodeGapY),
        });
      }
    }
  }

  return positions;
}

/**
 * Calculate the bounding box of all nodes
 */
export function calculateBoundingBox(
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number = 200,
  nodeHeight: number = 80
): { width: number; height: number; minX: number; minY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [, pos] of positions) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  }

  return {
    width: maxX - minX,
    height: maxY - minY,
    minX,
    minY,
  };
}

/**
 * Center the graph in a given viewport
 */
export function centerGraph(
  positions: Map<string, { x: number; y: number }>,
  viewportWidth: number,
  viewportHeight: number,
  nodeWidth: number = 200,
  nodeHeight: number = 80,
  padding: number = 100
): Map<string, { x: number; y: number; zoom: number }> {
  const bounds = calculateBoundingBox(positions, nodeWidth, nodeHeight);

  // Calculate zoom to fit
  const scaleX = (viewportWidth - padding * 2) / bounds.width;
  const scaleY = (viewportHeight - padding * 2) / bounds.height;
  const zoom = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1

  // Calculate offset to center
  const offsetX = (viewportWidth - bounds.width * zoom) / 2 - bounds.minX * zoom;
  const offsetY = (viewportHeight - bounds.height * zoom) / 2 - bounds.minY * zoom;

  const result = new Map<string, { x: number; y: number; zoom: number }>();

  for (const [nodeId, pos] of positions) {
    result.set(nodeId, {
      x: pos.x * zoom + offsetX,
      y: pos.y * zoom + offsetY,
      zoom,
    });
  }

  return result;
}
