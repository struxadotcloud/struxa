import { describe, expect, test } from "bun:test";
import { buildAllocationMappings, groupAllocationsByNode, requiredAllocationCount } from "./allocations";

describe("server allocations", () => {
  test("offer count includes the primary allocation", () => {
    expect(requiredAllocationCount(3)).toBe(3);
    expect(requiredAllocationCount(1)).toBe(1);
  });

  test("legacy zero/missing counts still provide a primary port", () => {
    for (const count of [0, undefined, null]) expect(requiredAllocationCount(count)).toBe(1);
  });

  test("ports on separate nodes cannot satisfy one offer", () => {
    const groups = groupAllocationsByNode([
      { id: "a", nodeId: "one" }, { id: "b", nodeId: "two" }, { id: "c", nodeId: "one" },
    ]);
    expect([...groups.values()].some((group) => group.length >= requiredAllocationCount(3))).toBe(false);
    expect(groups.get("one")?.map((a) => a.id)).toEqual(["a", "c"]);
  });

  test("an offer reserves exactly its count from one node", () => {
    const groups = groupAllocationsByNode(Array.from({ length: 5 }, (_, id) => ({ id, nodeId: "one" })));
    expect(groups.get("one")?.slice(0, requiredAllocationCount(3))).toHaveLength(3);
  });

  test("Wings receives primary and extra ports grouped by IP without duplicates", () => {
    const primary = { ip: "192.0.2.1", port: 25565 };
    expect(buildAllocationMappings(primary, [primary,
      { ip: "192.0.2.1", port: 25566 }, { ip: "192.0.2.2", port: 25567 },
    ])).toEqual({ "192.0.2.1": [25565, 25566], "192.0.2.2": [25567] });
  });

  test("legacy servers retain their primary even without an assignment row", () => {
    expect(buildAllocationMappings({ ip: "192.0.2.1", port: 25565 }, []))
      .toEqual({ "192.0.2.1": [25565] });
  });
});
