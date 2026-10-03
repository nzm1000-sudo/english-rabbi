import { act, fireEvent, render, screen } from '@testing-library/react';
import { ServicesProvider, type AppServices } from '@/app/services';
import { contentRegistry } from '@content/index';
import type { ChoiceItem } from '@/domain/content/schema';
import { CONTINUE_DELAY_MS, ExerciseView } from './ExerciseView';

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
    render(
      <ServicesProvider services={services}>
        <ExerciseView item={item} support="he" seed="s" policy="test" feedback="full" onDone={onDone} />
      </ServicesProvider>,
    );
    const correct = item.options.find((o) => o.id === item.correctOptionId)!;
    fireEvent.click(screen.getAllByText(correct.text)[0]!.closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'בדיקה' }));
    const cont = screen.getByRole('button', { name: 'המשך' });
    fireEvent.click(cont);
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(CONTINUE_DELAY_MS + 10));
    fireEvent.click(screen.getByRole('button', { name: 'המשך' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0]![0]).toMatchObject({ finalCorrect: true });
  } finally {
    vi.useRealTimers();
  }
});
