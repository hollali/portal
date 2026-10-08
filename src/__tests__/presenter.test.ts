import { describe, expect, it } from "vitest";
import { createPresenter, presenterReducer, type PresenterEvent, type PresenterInput } from "@/lib/presenter";

const input: PresenterInput = { cardCount: 3, limitationCount: 2 };

function reduce(events: PresenterEvent[], value = createPresenter()) {
  return events.reduce((state, event) => presenterReducer(input, state, event), value);
}

describe("presenter state machine", () => {
  it("starts with no cards visible", () => {
    expect(createPresenter()).toMatchObject({
      phase: "idle",
      activeIndex: null,
      visibleCards: [],
      spokenCharIndex: 0,
    });
  });

  it("starts with the neutral intro", () => {
    expect(reduce([{ type: "START" }])).toMatchObject({ phase: "intro", activeIndex: null });
  });

  it("reveals one card after the intro", () => {
    expect(reduce([{ type: "START" }, { type: "SPEECH_END" }])).toMatchObject({
      phase: "presenting",
      activeIndex: 0,
      visibleCards: [0],
    });
  });

  it("advances cards in order and never reveals a future card", () => {
    const state = reduce([
      { type: "START" },
      { type: "SPEECH_END" },
      { type: "SPEECH_END" },
    ]);
    expect(state).toMatchObject({ phase: "presenting", activeIndex: 1, visibleCards: [0, 1] });
  });

  it("tracks speech boundaries for the active segment", () => {
    const state = reduce([{ type: "START" }, { type: "SPEECH_BOUNDARY", charIndex: 27 }]);
    expect(state.spokenCharIndex).toBe(27);
  });

  it("moves from the last card into limitations", () => {
    const state = reduce([
      { type: "START" },
      { type: "SPEECH_END" },
      { type: "SPEECH_END" },
      { type: "SPEECH_END" },
      { type: "SPEECH_END" },
    ]);
    expect(state).toMatchObject({ phase: "limitations", limitationIndex: 0, visibleCards: [0, 1, 2] });
  });

  it("finishes after the final limitation", () => {
    const state = reduce([
      { type: "START" },
      { type: "SPEECH_END" },
      { type: "SPEECH_END" },
      { type: "SPEECH_END" },
      { type: "SPEECH_END" },
      { type: "SPEECH_END" },
      { type: "SPEECH_END" },
    ]);
    expect(state).toMatchObject({ phase: "done", activeIndex: null, limitationIndex: null });
  });

  it("skips the active segment", () => {
    expect(
      reduce([{ type: "START" }, { type: "SKIP" }, { type: "SKIP" }]),
    ).toMatchObject({ phase: "presenting", activeIndex: 1, visibleCards: [0, 1] });
  });

  it("reveals all cards when requested", () => {
    expect(reduce([{ type: "START" }, { type: "SHOW_ALL" }])).toMatchObject({
      phase: "done",
      activeIndex: null,
      visibleCards: [0, 1, 2],
    });
  });

  it("reveals all cards when narration is muted", () => {
    expect(reduce([{ type: "START" }, { type: "SET_MUTED", muted: true }])).toMatchObject({
      phase: "done",
      muted: true,
      visibleCards: [0, 1, 2],
    });
  });

  it("replays from the intro while preserving mute choice", () => {
    const state = reduce([{ type: "SET_MUTED", muted: true }, { type: "REPLAY" }]);
    expect(state).toMatchObject({ phase: "intro", muted: true, visibleCards: [] });
  });

  it("handles answers without cards or limitations", () => {
    const empty = createPresenter();
    expect(presenterReducer({ cardCount: 0, limitationCount: 0 }, empty, { type: "START" }).phase).toBe("done");
  });
});
