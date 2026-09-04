import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { StopEditor } from "./StopEditor";
import { makeStop } from "../lib/route";

describe("StopEditor city autocomplete", () => {
  it("fills rail coordinates when a salesperson selects a city", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "1304000", city: "Atlanta", state: "GA", name: "Atlanta, GA", coords: [33.7726, -84.40666], railDistanceMiles: 1.1 },
      ],
    }));
    const onChange = vi.fn();
    function Harness() {
      const [stop, setStop] = useState(makeStop(0, { name: "", coords: [Number.NaN, Number.NaN] }));
      return <StopEditor stop={stop} index={0} total={2} onChange={(next) => { setStop(next); onChange(next); }} onRemove={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} />;
    }
    render(<Harness />);

    const input = screen.getByRole("combobox", { name: "City or rail location" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Atlanta" } });
    const option = await screen.findByRole("option", { name: /Atlanta, GA/ });
    fireEvent.mouseDown(option);
    fireEvent.click(option);

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      name: "Atlanta, GA",
      coords: [33.7726, -84.40666],
    })));
    vi.unstubAllGlobals();
  });

  it("offers accessible arrow controls for reordering stops", () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    render(<StopEditor stop={makeStop(1, { name: "Atlanta" })} index={1} total={3} onChange={vi.fn()} onRemove={vi.fn()} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />);

    fireEvent.click(screen.getByRole("button", { name: "Move Atlanta up" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Atlanta down" }));

    expect(onMoveUp).toHaveBeenCalledOnce();
    expect(onMoveDown).toHaveBeenCalledOnce();
  });
});
