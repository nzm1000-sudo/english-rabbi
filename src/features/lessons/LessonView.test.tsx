import { render } from '@testing-library/react';
import type { Lesson } from '@/domain/content/schema';
import { ServicesProvider, type AppServices } from '@/app/services';
import { LessonView } from './LessonView';

const lesson = {
  id: 'lesson.t',
  skill: 'grammar.prepositions',
  level: 'A2',
  title: { he: 'מילות יחס', en: 'Prepositions' },
  goal: 'מטרה',
  blocks: [
    { kind: 'table', head: ['', 'in', 'on', 'at'], rows: [['זמן', 'חודש', 'יום', 'שעה']] },
    { kind: 'table', head: ['מילה', 'דוגמה'], rows: [['since', 'since 2019']] },
  ],
} as unknown as Lesson;

const IDLE = { status: 'idle' } as const;

it('a wide English table scrolls from its first column, a Hebrew one from the right', () => {
  const services = { speech: { subscribe: () => () => {}, getState: () => IDLE }, settings: { get: () => undefined } } as unknown as AppServices;
  const { container } = render(
    <ServicesProvider services={services}>
      <LessonView lesson={lesson} />
    </ServicesProvider>,
  );
  const boxes = [...container.querySelectorAll('.table-scroll')];
  expect(boxes.map((b) => b.getAttribute('dir'))).toEqual(['ltr', 'rtl']);
});
