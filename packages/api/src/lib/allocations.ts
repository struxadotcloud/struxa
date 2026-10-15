type Allocation = { ip: string; port: number };

// A server always needs a primary port, including legacy offers configured with zero.
export function requiredAllocationCount(count?: number | null) {
  return Math.max(1, count ?? 1);
}

export function groupAllocationsByNode<T extends { nodeId: string }>(allocations: T[]) {
  const groups = new Map<string, T[]>();
  for (const allocation of allocations) {
    const group = groups.get(allocation.nodeId) ?? [];
    group.push(allocation);
    groups.set(allocation.nodeId, group);
  }
  return groups;
}

export function buildAllocationMappings(primary: Allocation, allocations: Allocation[]) {
  const mappings: Record<string, number[]> = {};
  for (const allocation of [primary, ...allocations]) {
    const ports = mappings[allocation.ip] ??= [];
    if (!ports.includes(allocation.port)) ports.push(allocation.port);
  }
  return mappings;
}
