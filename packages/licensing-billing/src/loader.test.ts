import { describe, expect, it, vi } from "vitest";
import { defaultProductConfig } from "./defaults";
import { loadProductConfig } from "./loader";

describe("loadProductConfig", () => {
  it("returns fallback when no url is provided", async () => {
    await expect(loadProductConfig()).resolves.toEqual(defaultProductConfig);
  });

  it("parses remote config when valid", async () => {
    const remote = {
      ...defaultProductConfig,
      brand: { ...defaultProductConfig.brand, name: "RemoteBrand" },
    };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => remote,
    })) as unknown as typeof fetch;

    const config = await loadProductConfig({ url: "https://example.test/product.json", fetchImpl });
    expect(config.brand.name).toBe("RemoteBrand");
  });

  it("falls back when remote payload is invalid", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ brand: { name: "broken" } }),
    })) as unknown as typeof fetch;

    const config = await loadProductConfig({ url: "https://example.test/product.json", fetchImpl });
    expect(config).toEqual(defaultProductConfig);
  });
});
