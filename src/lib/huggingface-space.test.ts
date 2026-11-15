import { describe, expect, it } from "vitest";
import { isHuggingFaceSpaceId } from "@/lib/huggingface-space";

describe("isHuggingFaceSpaceId", () => {
  it("accepts a Hugging Face namespace and Space name", () => {
    expect(isHuggingFaceSpaceId("raphaelpera85/virapeca-triposr")).toBe(true);
  });

  it("rejects malformed IDs and URLs before exposing them to the client", () => {
    expect(isHuggingFaceSpaceId("https://huggingface.co/spaces/user/demo")).toBe(false);
    expect(isHuggingFaceSpaceId("user/demo/extra")).toBe(false);
    expect(isHuggingFaceSpaceId("user with spaces/demo")).toBe(false);
    expect(isHuggingFaceSpaceId("")).toBe(false);
  });
});
