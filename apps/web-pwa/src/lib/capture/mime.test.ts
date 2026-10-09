import { describe, expect, it } from "vitest";
import {
  extensionForMime,
  formatCaptureDeviceLabel,
  kindFromRecorderMime,
  pickRecorderMimeType,
} from "./mime";

describe("capture mime helpers", () => {
  it("picks first supported mime", () => {
    const mime = pickRecorderMimeType({
      preferVideo: true,
      isTypeSupported: (m) => m === "video/webm",
    });
    expect(mime).toBe("video/webm");
  });

  it("maps mime to extension and kind", () => {
    expect(extensionForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForMime("video/mp4")).toBe("mp4");
    expect(kindFromRecorderMime("audio/webm")).toBe("audio");
    expect(kindFromRecorderMime("video/webm")).toBe("video");
  });

  it("formats empty device labels", () => {
    expect(formatCaptureDeviceLabel("", "video", 0)).toBe("Caméra 1");
    expect(formatCaptureDeviceLabel("  Mic USB  ", "audio", 2)).toBe("Mic USB");
  });
});
