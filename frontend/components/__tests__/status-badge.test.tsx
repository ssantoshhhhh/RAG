import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/status-badge";

describe("StatusBadge", () => {
  it.each([
    ["INDEXED", "Indexed"],
    ["PROCESSING", "Processing"],
    ["UPLOADED", "Queued"],
    ["FAILED", "Failed"],
  ] as const)("renders a label for %s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});