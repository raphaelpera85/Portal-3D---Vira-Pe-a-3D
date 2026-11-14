import { describe, expect, it } from "vitest";
import { readLimitedBody } from "./request-body";

function bodyStream(chunks: number[][], onCancel = () => {}) {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index === chunks.length) controller.close();
      else controller.enqueue(Uint8Array.from(chunks[index++]));
    },
    cancel: onCancel,
  });
}

describe("readLimitedBody", () => {
  it("reads a request body within its byte limit", async () => {
    const result = await readLimitedBody(bodyStream([[1, 2], [3]]), 3);
    expect(result).toEqual(Uint8Array.from([1, 2, 3]));
  });

  it("stops and cancels the stream when actual bytes exceed the limit", async () => {
    let canceled = false;
    const result = await readLimitedBody(bodyStream([[1, 2], [3, 4]], () => { canceled = true; }), 3);
    expect(result).toBeNull();
    expect(canceled).toBe(true);
  });
});
