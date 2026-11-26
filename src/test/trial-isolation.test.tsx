import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { DraftProvider, useDraft } from '@/lib/draft-store';

function Editor({ label }: { label: string }) {
  const { draft, updateExperimentDetails } = useDraft();
  return <div><span data-testid={label}>{draft.name}</span><button onClick={() => updateExperimentDetails({ name: 'Temporary trial' })}>Edit {label}</button></div>;
}
it('keeps the trial draft separate from the demo and browser storage', () => {
  const key = 'suxl-experiment-draft-v1';
  sessionStorage.setItem(key, JSON.stringify({ name: 'Saved demo', variants: [] }));
  const original = sessionStorage.getItem(key);
  render(<DraftProvider ephemeral><Editor label="trial" /></DraftProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Edit trial' }));
  expect(screen.getByTestId('trial')).toHaveTextContent('Temporary trial');
  expect(sessionStorage.getItem(key)).toBe(original);
});
