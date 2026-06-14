import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("concatène les classes conditionnelles", () => {
    const show = false as boolean;
    expect(cn("a", show && "b", "c")).toBe("a c");
  });

  it("dédoublonne les classes Tailwind en conflit (la dernière gagne)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
