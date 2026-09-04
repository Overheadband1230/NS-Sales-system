import { describe, expect, it } from "vitest";
import { createBlankRoute } from "./route";
import { applyRoutePreset, routePresetChoices } from "./routePresets";

describe("local tracker route presets", () => {
  it("offers both directions for reversible corridors", () => {
    expect(routePresetChoices.some((choice) => choice.id === "atlanta-croxton:forward")).toBe(true);
    expect(routePresetChoices.some((choice) => choice.id === "atlanta-croxton:reverse")).toBe(true);
  });

  it("loads the selected direction while preserving shipment details", () => {
    const draft = createBlankRoute();
    draft.customer = "Example customer";
    draft.commodity = "Steel";

    const preset = applyRoutePreset(draft, "atlanta-croxton:reverse");

    expect(preset.trainId).toBe("25A");
    expect(preset.customer).toBe("Example customer");
    expect(preset.commodity).toBe("Steel");
    expect(preset.stops[0].name).toBe("Croxton, NJ");
    expect(preset.stops.at(-1)?.name).toBe("Atlanta, GA");
    expect(preset.currentPosition).toEqual({ mode: "stop", stopId: preset.stops[0].id });
  });
});
