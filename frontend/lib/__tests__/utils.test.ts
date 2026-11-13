import { describe, expect, it } from "vitest";

import {
  ACTIVE_STATUSES,
  formatFileSize,
  formatRelativeTime,
  initials,
  isActiveStatus,
  statusLabel,
  truncate,
} from "@/lib/utils";

describe("formatFileSize", () => {
  it("formats bytes, kilobytes, and megabytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB");
  });
});

describe("status helpers", () => {
  it("labels every document status", () => {
    expect(statusLabel("UPLOADED")).toBe("Queued");
    expect(statusLabel("PROCESSING")).toBe("Processing");
    expect(statusLabel("INDEXING")).toBe("Indexing");
    expect(statusLabel("INDEXED")).toBe("Indexed");
    expect(statusLabel("FAILED")).toBe("Failed");
  });

  it("identifies in-flight statuses", () => {
    expect(ACTIVE_STATUSES).toEqual(["UPLOADED", "PROCESSING", "INDEXING"]);
    expect(isActiveStatus("PROCESSING")).toBe(true);
    expect(isActiveStatus("INDEXED")).toBe(false);
    expect(isActiveStatus("FAILED")).toBe(false);
  });
});

describe("misc helpers", () => {
  it("builds initials from the first two name parts", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("grace")).toBe("G");
    expect(initials("")).toBe("DM");
  });

  it("truncates long strings with an ellipsis", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("a".repeat(30), 10)).toHaveLength(10);
    expect(truncate("a".repeat(30), 10).endsWith("…")).toBe(true);
  });

  it("formats relative times from ISO timestamps", () => {
    expect(formatRelativeTime(null)).toBe("Just now");
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toMatch(/5 minutes ago/);
  });
});