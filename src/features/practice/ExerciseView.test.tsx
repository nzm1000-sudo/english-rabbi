import { act, fireEvent, render, screen } from '@testing-library/react';
import { ServicesProvider, type AppServices } from '@/app/services';
import { contentRegistry } from '@content/index';
import type { ChoiceItem, TypedItem } from '@/domain/content/schema';
import { CONTINUE_DELAY_MS, ExerciseView, isHebrewOnly } from './ExerciseView';

/**
 * Regression: "המשך" appears where "בדיקה" was, so the second tap of a
 * double tap on "בדיקה" skipped the feedback and moved to the next question.
 */
it('ignores "המשך" right after checking, then continues once', () => {
  vi.useFakeTimers();
  try {
    const item = contentRegistry.items.find((i): i is ChoiceItem => i.type === 'choice' && i.modality === 'read' && !i.passageId)!;
    const idle = { speaking: false };
    const speech = { stop: vi.fn(), speak: vi.fn(), subscribe: () => () => {}, getState: () => idle };
    const services = { content: contentRegistry, speech } as unknown as AppServices;
    const onDone = vi.fn();
    const onAnswer = vi.fn();
    render(
      <ServicesProvider services={services}>
        <ExerciseView item={item} support="he" seed="s" policy="test" feedback="full" onAnswer={onAnswer} onDone={onDone} />
      </ServicesProvider>,
    );
    const correct = item.options.find((o) => o.id === item.correctOptionId)!;
    fireEvent.click(screen.getAllByText(correct.text)[0]!.closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'בדיקה' }));
    // The answer is saved at "בדיקה", before any "המשך".
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer.mock.calls[0]![0]).toMatchObject({ finalCorrect: true });
    const cont = screen.getByRole('button', { name: 'המשך' });
    fireEvent.click(cont);
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(CONTINUE_DELAY_MS + 10));
    fireEvent.click(screen.getByRole('button', { name: 'המשך' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0]![0]).toMatchObject({ finalCorrect: true });
    expect(onAnswer).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

/** Regression: an answer typed with the Hebrew keyboard counted as a wrong attempt and used up a hint. */
it('does not count an answer typed with the Hebrew keyboard', () => {
  const item = contentRegistry.items.find((i): i is TypedItem => i.type === 'typed' && i.modality === 'read' && !i.passageId && i.hints.length > 0)!;
  const idle = { speaking: false };
  const speech = { stop: vi.fn(), speak: vi.fn(), subscribe: () => () => {}, getState: () => idle };
  const services = { content: contentRegistry, speech } as unknown as AppServices;
  render(
    <ServicesProvider services={services}>
      <ExerciseView item={item} support="he" seed="s" onDone={vi.fn()} />
    </ServicesProvider>,
  );
  const input = screen.getByLabelText('תשובה');
  fireEvent.change(input, { target: { value: 'שלום' } });
  fireEvent.click(screen.getByRole('button', { name: 'בדיקה' }));
  expect(screen.getByText(/המקלדת בעברית/)).toBeInTheDocument();
  expect(screen.queryByText('רמז 1')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: 'zzzz' } });
  expect(screen.queryByText(/המקלדת בעברית/)).not.toBeInTheDocument();
});

it('isHebrewOnly', () => {
  expect(isHebrewOnly('שלום')).toBe(true);
  expect(isHebrewOnly('hello')).toBe(false);
  expect(isHebrewOnly('take את')).toBe(false);
  expect(isHebrewOnly('123')).toBe(false);
});
