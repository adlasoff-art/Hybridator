import { describe, expect, it } from "vitest";
import { handleGenerativeEdit, handleGenerativeProject } from "./ai-generate.server";

describe("ai-generate server (demo path)", () => {
  it("builds a project plan without API key", async () => {
    const plan = await handleGenerativeProject({
      projectId: "p",
      prompt: "Vidéo 20 secondes avec musique",
      durationSec: 20,
    });
    expect(plan.durationSec).toBe(20);
    expect(plan.mode).toBe("demo");
    expect(plan.clips.length).toBeGreaterThan(2);
  });

  it("builds edit intents from natural language", async () => {
    const edit = await handleGenerativeEdit({
      projectId: "p",
      clipId: "c1",
      instruction: "Ajoute un flou et une transition",
    });
    expect(edit.intents.length).toBeGreaterThan(0);
    expect(edit.mode).toBe("demo");
  });
});
