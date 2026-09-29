import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

function BrokenContent(): never {
  throw new Error('Expected test failure');
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('replaces a failed screen with a recoverable error state', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <BrokenContent />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Frontier could not load');
    expect(screen.getByRole('button', { name: 'Reload Frontier' })).toBeInTheDocument();
  });
});
