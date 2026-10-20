import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  const router = () => createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches a page for / instead of falling back to not found", () => {
    const matches = router().matchRoutes("/");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches /app dashboard layout and index", () => {
    const matches = router().matchRoutes("/app");
    const ids = matches.map((m) => m.routeId);
    expect(ids).toContain("/app");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches Creator OS stubs under /app/*", () => {
    const stubs = [
      "/app/journey",
      "/app/strategy",
      "/app/ideas",
      "/app/studio",
      "/app/formats",
      "/app/publish",
      "/app/analytics",
      "/app/library",
      "/app/templates",
      "/app/resources",
    ];
    for (const path of stubs) {
      const matches = router().matchRoutes(path);
      expect(matches.at(-1)?.routeId).toBe(path);
    }
  });

  it("keeps editor and projects routes intact", () => {
    expect(router().matchRoutes("/editor").at(-1)?.routeId).toBe("/editor");
    expect(router().matchRoutes("/projects").at(-1)?.routeId).toBe("/projects");
    expect(router().matchRoutes("/account").at(-1)?.routeId).toBe("/account");
    expect(router().matchRoutes("/pricing").at(-1)?.routeId).toBe("/pricing");
  });
});
