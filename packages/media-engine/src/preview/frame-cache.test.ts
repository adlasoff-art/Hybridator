import { describe, expect, it } from "vitest";
import { ScrubFrameCache } from "./frame-cache";

describe("ScrubFrameCache", () => {
  it("keys quantize time and tracks LRU eviction", () => {
    const cache = new ScrubFrameCache(2, 0.1);
    expect(cache.key("a", 0.02)).toBe(cache.key("a", 0.03));
    expect(cache.key("a", 0)).not.toBe(cache.key("a", 0.2));

    // ImageBitmap n'existe pas toujours en Node — mock minimal
    const fake = (id: number) =>
      ({
        width: 1,
        height: 1,
        close: () => undefined,
        id,
      }) as unknown as ImageBitmap;

    cache.put("v", 0, fake(1));
    cache.put("v", 0.2, fake(2));
    expect(cache.stats().size).toBe(2);
    cache.put("v", 0.4, fake(3));
    expect(cache.stats().size).toBe(2);
    expect(cache.get("v", 0)).toBeUndefined();
    expect(cache.get("v", 0.2)).toBeTruthy();
    const s = cache.stats();
    expect(s.hits).toBeGreaterThanOrEqual(1);
    expect(s.misses).toBeGreaterThanOrEqual(1);
    cache.clear();
    expect(cache.stats().size).toBe(0);
  });
});
