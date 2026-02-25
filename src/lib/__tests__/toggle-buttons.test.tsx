import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { test, expect } from "vitest";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// A minimal harness that mirrors how MainContent uses the toggle tabs
function ToggleHarness() {
  const [activeView, setActiveView] = useState<"preview" | "code">("preview");

  return (
    <div>
      <Tabs
        value={activeView}
        onValueChange={(v) => setActiveView(v as "preview" | "code")}
      >
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
      </Tabs>
      <div data-testid="content">
        {activeView === "preview" ? (
          <div data-testid="preview-content">Preview Panel</div>
        ) : (
          <div data-testid="code-content">Code Panel</div>
        )}
      </div>
    </div>
  );
}

test("preview tab is active by default", () => {
  render(<ToggleHarness />);

  const previewTab = screen.getByRole("tab", { name: "Preview" });
  const codeTab = screen.getByRole("tab", { name: "Code" });

  expect(previewTab.getAttribute("data-state")).toBe("active");
  expect(codeTab.getAttribute("data-state")).toBe("inactive");
  expect(screen.getByTestId("preview-content")).toBeDefined();
  expect(screen.queryByTestId("code-content")).toBeNull();
});

test("clicking Code tab switches to code view", async () => {
  const user = userEvent.setup();
  render(<ToggleHarness />);

  const codeTab = screen.getByRole("tab", { name: "Code" });
  await user.click(codeTab);

  expect(codeTab.getAttribute("data-state")).toBe("active");
  expect(
    screen.getByRole("tab", { name: "Preview" }).getAttribute("data-state")
  ).toBe("inactive");
  expect(screen.getByTestId("code-content")).toBeDefined();
  expect(screen.queryByTestId("preview-content")).toBeNull();
});

test("clicking Preview tab switches back to preview view", async () => {
  const user = userEvent.setup();
  render(<ToggleHarness />);

  // First switch to code
  await user.click(screen.getByRole("tab", { name: "Code" }));
  expect(screen.queryByTestId("preview-content")).toBeNull();

  // Then switch back to preview
  await user.click(screen.getByRole("tab", { name: "Preview" }));

  expect(
    screen.getByRole("tab", { name: "Preview" }).getAttribute("data-state")
  ).toBe("active");
  expect(screen.getByTestId("preview-content")).toBeDefined();
  expect(screen.queryByTestId("code-content")).toBeNull();
});

test("clicking the already-active tab does not change the view", async () => {
  const user = userEvent.setup();
  render(<ToggleHarness />);

  // Click Preview while it's already active
  await user.click(screen.getByRole("tab", { name: "Preview" }));

  expect(
    screen.getByRole("tab", { name: "Preview" }).getAttribute("data-state")
  ).toBe("active");
  expect(screen.getByTestId("preview-content")).toBeDefined();
});

test("toggling multiple times works correctly", async () => {
  const user = userEvent.setup();
  render(<ToggleHarness />);

  for (let i = 0; i < 3; i++) {
    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByTestId("code-content")).toBeDefined();
    expect(screen.queryByTestId("preview-content")).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByTestId("preview-content")).toBeDefined();
    expect(screen.queryByTestId("code-content")).toBeNull();
  }
});
