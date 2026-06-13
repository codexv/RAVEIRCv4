import { describe, it, expect } from "vitest";
import { UI_FONTS, MONO_FONTS, ACCENTS } from "./appearance.svelte";
import { FONT_CHOICES } from "./fonts";

// These lists feed keyed `{#each}` blocks in the UI. Two items with the same
// key crash the render with Svelte's each_key_duplicate (this exact bug shipped
// in UI_FONTS, where "Sans"/"Helvetica" and "Serif"/"Georgia" shared a value).
// The font dropdowns key by `label`; the FontPicker keys by `value`.
const dups = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe("font lists have collision-free keys", () => {
  it("UI_FONTS labels are unique (dropdown keys by label)", () => {
    expect(dups(UI_FONTS.map((f) => f.label))).toEqual([]);
  });
  it("MONO_FONTS labels are unique (dropdown keys by label)", () => {
    expect(dups(MONO_FONTS.map((f) => f.label))).toEqual([]);
  });
  it("FONT_CHOICES values are unique (picker keys by value)", () => {
    expect(dups(FONT_CHOICES.map((f) => f.value))).toEqual([]);
  });
  it("accent swatches are unique (each keys by colour)", () => {
    expect(dups([...ACCENTS])).toEqual([]);
  });
});
