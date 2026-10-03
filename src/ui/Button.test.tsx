import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from './Button';
import { ConfirmSheet } from './Sheet';

describe('Button', () => {
  it('renders variant and size classes and is a plain button by default', () => {
    render(<Button variant="primary" size="lg">שמירה</Button>);
    const b = screen.getByRole('button', { name: 'שמירה' });
    expect(b.className).toContain('btn-primary');
    expect(b.className).toContain('btn-lg');
    expect(b).toHaveAttribute('type', 'button');
  });

  it('is disabled and busy while loading', () => {
    render(<Button loading>שמירה</Button>);
    const b = screen.getByRole('button');
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
  });
});

describe('ConfirmSheet', () => {
  it('asks in a dialog and confirms or cancels', () => {
    const yes = vi.fn();
    const no = vi.fn();
    render(<ConfirmSheet open title="להסתיר את Dana?" body="אפשר לשחזר." confirmLabel="הסתרה" danger onConfirm={yes} onCancel={no} />);
    expect(screen.getByRole('dialog', { name: 'להסתיר את Dana?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'הסתרה' }));
    expect(yes).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(no).toHaveBeenCalledOnce();
  });

  it('renders nothing when closed', () => {
    render(<ConfirmSheet open={false} title="t" body="b" confirmLabel="c" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
