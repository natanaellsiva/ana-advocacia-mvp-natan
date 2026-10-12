import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui-kit";
import { taskStatusLabel, taskTone } from "@/lib/domain";

describe("Selo de tarefa pendente", () => {
  it("mantém superfície distinta, borda e texto explícito", () => {
    render(<Badge className={taskTone.pendente}>{taskStatusLabel.pendente}</Badge>);
    expect(screen.getByText("Pendente")).toHaveClass("bg-card", "text-foreground", "border", "border-muted-foreground");
  });
});