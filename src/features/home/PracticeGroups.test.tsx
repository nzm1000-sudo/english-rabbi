import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PracticeGroups } from './PracticeGroups';
import { GROUPS } from './practiceCatalog';

const show = (props: { studentId?: string; due?: number } = {}) =>
  render(
    <MemoryRouter>
      <PracticeGroups studentId={props.studentId ?? 'st-1'} due={props.due ?? 0} />
    </MemoryRouter>,
  );

const header = (title: string) => screen.getByRole('button', { name: new RegExp(title) });

describe('PracticeGroups', () => {
  afterEach(() => localStorage.clear());

  it('shows the four groups closed, in order, as headings', () => {
    show();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false']);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(GROUPS.map((g) => expect.stringContaining(g.title)));
    // Closed groups keep their links out of reach (no tab stop, hidden from screen readers).
    expect(screen.queryByRole('link', { name: /תרגום/ })).toBeNull();
  });

  it('opens one group at a time and fans out its practice modes', () => {
    show();
    fireEvent.click(header('כותבים ומתקנים'));
    expect(header('כותבים ומתקנים')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /כותבים ומתקנים/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /תרגום/ })).toHaveAttribute('href', '/s/st-1/practice/translate');

    fireEvent.click(header('משחקים ואתגרים'));
    expect(header('משחקים ואתגרים')).toHaveAttribute('aria-expanded', 'true');
    expect(header('כותבים ומתקנים')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /תרגום/ })).toBeNull();

    fireEvent.click(header('משחקים ואתגרים'));
    expect(header('משחקים ואתגרים')).toHaveAttribute('aria-expanded', 'false');
  });

  it('remembers the open group for each student', () => {
    const { unmount } = show();
    fireEvent.click(header('לומדים ומחזקים'));
    unmount();
    show();
    expect(header('לומדים ומחזקים')).toHaveAttribute('aria-expanded', 'true');
    // Another student starts closed.
    show({ studentId: 'st-2' });
    expect(screen.getAllByRole('button', { name: /לומדים ומחזקים/ })[1]).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the words waiting for review on the learn group, and only when there are some', () => {
    const { unmount } = show({ due: 5 });
    expect(header('לומדים ומחזקים')).toHaveTextContent('5 לחזרה');
    fireEvent.click(header('לומדים ומחזקים'));
    expect(screen.getByRole('link', { name: /^חזרה/ })).toHaveTextContent('5 מילים לחזרה היום');
    unmount();
    localStorage.clear();
    show({ due: 0 });
    expect(header('לומדים ומחזקים')).not.toHaveTextContent('לחזרה');
  });

  it('moves between headers with the arrow keys, Home and End', () => {
    show();
    const [first, second, , last] = screen.getAllByRole('button');
    first!.focus();
    fireEvent.keyDown(first!, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second!, { key: 'End' });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last!, { key: 'ArrowDown' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first!, { key: 'ArrowUp' });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last!, { key: 'Home' });
    expect(first).toHaveFocus();
  });
});
