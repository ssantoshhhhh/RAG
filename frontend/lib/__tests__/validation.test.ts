import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_BYTES, validateFiles } from "@/lib/validation";

function fileWithSize(name: string, size: number): File {
  const file = new File(["content"], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateFiles", () => {
  it("accepts pdf and txt files", () => {
    const pdf = fileWithSize("report.PDF", 1024);
    const txt = fileWithSize("notes.txt", 2048);
    const result = validateFiles([pdf, txt]);

    expect(result.errors).toEqual([]);
    expect(result.accepted).toEqual([pdf, txt]);
  });

  it("rejects unsupported extensions", () => {
    const result = validateFiles([new File(["x"], "data.docx")]);

    expect(result.accepted).toEqual([]);
    expect(result.errors[0]).toContain("only PDF and TXT");
  });

  it("rejects empty and oversized files", () => {
    const empty = fileWithSize("empty.pdf", 0);
    const huge = fileWithSize("huge.pdf", MAX_UPLOAD_BYTES + 1);
    const result = validateFiles([empty, huge]);

    expect(result.accepted).toEqual([]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain("empty");
    expect(result.errors[1]).toContain("10 MB");
  });

  it("keeps valid files while reporting invalid ones", () => {
    const good = fileWithSize("good.pdf", 100);
    const bad = fileWithSize("bad.exe", 100);
    const result = validateFiles([good, bad]);

    expect(result.accepted).toEqual([good]);
    expect(result.errors).toHaveLength(1);
  });
});