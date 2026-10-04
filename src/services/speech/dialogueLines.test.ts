import { describe, expect, it } from 'vitest';
import { dialogueLines } from './textPrep';

describe('dialogueLines', () => {
  it('splits a written dialogue into lines with one voice per person', () => {
    expect(dialogueLines("Dan: Are you coming tonight? Maya: I can't, I have to study. Dan: Too bad!")).toEqual([
      { speaker: 'A', text: 'Are you coming tonight?' },
      { speaker: 'B', text: "I can't, I have to study." },
      { speaker: 'A', text: 'Too bad!' },
    ]);
  });

  it('keeps two-word roles and gives a third person the first voice again', () => {
    expect(dialogueLines('Shop Assistant: Can I help? Customer: Just looking. Manager: Welcome!')!.map((l) => l.speaker)).toEqual(['A', 'B', 'A']);
  });

  it('leaves ordinary sentences alone', () => {
    expect(dialogueLines('The train leaves at 10:30 from platform two.')).toBeNull();
    expect(dialogueLines('Remember: always lock the door.')).toBeNull();
    expect(dialogueLines('Note: one. Note: two.')).toBeNull();
    expect(dialogueLines('I said: Dan: hello. Maya: hi.')).toBeNull();
  });
});
