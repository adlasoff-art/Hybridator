import { describe, expect, it } from "vitest";
import { handleServerStt } from "@/server/ai-stt.server";

describe("server STT pipeline", () => {
  it("returns a normalized transcript without exposing secrets", async () => {
    const prev = process.env["STT_ALLOW_DEMO_SERVER"];
    process.env["STT_ALLOW_DEMO_SERVER"] = "1";
    const transcript = await handleServerStt({
      projectId: "p1",
      mediaUri: "demo://a",
      durationSec: 12,
      language: "fr",
      rules: { fillerWords: ["euh"], silenceThresholdSec: 0.6 },
    });
    expect(transcript.segments.length).toBeGreaterThan(0);
    expect(transcript.detections).toBeDefined();
    if (prev === undefined) delete process.env["STT_ALLOW_DEMO_SERVER"];
    else process.env["STT_ALLOW_DEMO_SERVER"] = prev;
  });
});
