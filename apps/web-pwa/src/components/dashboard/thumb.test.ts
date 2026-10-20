import { describe, expect, it } from "vitest";
import { projectInitials, projectThumbStyle } from "./thumb";

describe("dashboard thumbs", () => {
  it("derives stable local gradients without remote URLs", () => {
    const a = projectThumbStyle("id-1", "Mon vlog");
    const b = projectThumbStyle("id-1", "Mon vlog");
    expect(a).toEqual(b);
    expect(String(a.background)).toMatch(/^linear-gradient/);
    expect(String(a.background)).not.toMatch(/unsplash|http/i);
  });

  it("builds initials from the project name", () => {
    expect(projectInitials("Mon premier vlog")).toBe("MP");
    expect(projectInitials("Solo")).toBe("SO");
    expect(projectInitials("   ")).toBe("P");
  });
});
