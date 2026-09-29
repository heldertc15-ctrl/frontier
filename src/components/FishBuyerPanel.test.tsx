import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FishBuyerState } from '../../server/fishBuyer';
import { FishBuyerPanel } from './FishBuyerPanel';

const { prepareCashRegisterSound, playCashRegisterSound } = vi.hoisted(() => {
  const playCashRegisterSound = vi.fn();
  return {
    playCashRegisterSound,
    prepareCashRegisterSound: vi.fn(() => playCashRegisterSound),
  };
});
vi.mock('../audio/cashRegister', () => ({ prepareCashRegisterSound }));

beforeEach(() => vi.clearAllMocks());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const buyer: FishBuyerState = {
  available: true,
  offers: [
    {
      stackId: 'a'.repeat(32),
      speciesId: 'mackerel',
      name: 'Mackerel',
      artworkPath: '/assets/items/mackerel.png',
      totalCredits: 24,
      specimens: [
        { id: 'b'.repeat(32), weightKg: 0.3, trophy: false, credits: 9, creditsPerKg: null },
        { id: 'c'.repeat(32), weightKg: 0.75, trophy: true, credits: 15, creditsPerKg: 20 },
      ],
    },
    {
      stackId: 'd'.repeat(32),
      speciesId: 'sardine',
      name: 'Sardine',
      artworkPath: '/assets/items/sardine.png',
      totalCredits: 6,
      specimens: [
        { id: 'e'.repeat(32), weightKg: 0.08, trophy: false, credits: 3, creditsPerKg: null },
        { id: 'f'.repeat(32), weightKg: 0.09, trophy: false, credits: 3, creditsPerKg: null },
      ],
    },
  ],
};

function response(payload: unknown, ok = true) {
  return { ok, json: async () => payload };
}

function afterSale(creditsEarned: number) {
  return response({
    buyer: {
      available: true,
      offers:
        creditsEarned === 15
          ? [
              { ...buyer.offers[0], totalCredits: 9, specimens: [buyer.offers[0].specimens[0]] },
              buyer.offers[1],
            ]
          : [buyer.offers[1]],
    },
    creditsEarned,
    character: { credits: 250 + creditsEarned },
  });
}

function setup(fetchMock = vi.fn().mockResolvedValue(response({ buyer }))) {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'sale-request-1234') });
  const onCharacter = vi.fn();
  const onInventoryChange = vi.fn();
  const props = { onCharacter, onInventoryChange, refreshRevision: 0 };
  const view = render(<FishBuyerPanel {...props} />);
  return { ...view, props, fetchMock, onCharacter, onInventoryChange };
}

async function appraiseMackerel() {
  fireEvent.click(await screen.findByRole('button', { name: 'Appraise Mackerel stack 1' }));
  return screen.getByRole('region', { name: 'Appraise Mackerel' });
}

function reviewOffer() {
  fireEvent.click(screen.getByRole('button', { name: 'Review offer' }));
  return screen.getByRole('group', { name: 'Confirm fish sale' });
}

function postBodies(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter(([path]) => path === '/api/fish-buyer/sell')
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

describe('Fishing Store buyer panel', () => {
  it('opens one appraisal and replaces it when another stack is selected', async () => {
    const { fetchMock } = setup();
    await screen.findByRole('button', { name: 'Appraise Mackerel stack 1' });
    expect(screen.getAllByRole('region', { name: /^Appraise / })).toHaveLength(1);
    await appraiseMackerel();
    const firstConfirmation = reviewOffer();
    expect(firstConfirmation.contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^Appraise Sardine stack/ }));
    expect(screen.getByRole('region', { name: 'Appraise Sardine' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Appraise Mackerel' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Confirm fish sale' })).toBeNull();
    expect(postBodies(fetchMock)).toEqual([]);
    expect(prepareCashRegisterSound).not.toHaveBeenCalled();
    expect(playCashRegisterSound).not.toHaveBeenCalled();
  });

  it('protects an individual Trophy selection through cancel and Escape, then sells the chosen fish', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (path: string) =>
        path === '/api/fish-buyer' ? response({ buyer }) : afterSale(15),
      );
    const { onCharacter, onInventoryChange } = setup(fetchMock);
    const appraisal = await appraiseMackerel();
    expect(
      screen.getByRole('button', { name: 'Deselect Mackerel, 0.750 kg, Trophy' }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ordinary only' }));
    expect(
      screen.getByRole('button', { name: 'Select Mackerel, 0.750 kg, Trophy' }),
    ).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Deselect Mackerel, 0.300 kg' }));
    expect(screen.getByRole('button', { name: 'Review offer' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Select Mackerel, 0.750 kg, Trophy' }));
    expect(within(appraisal).getByText('20.00 Cr/kg · Trophy offer')).toBeTruthy();
    reviewOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Keep fish' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review offer' })).toHaveFocus());
    expect(postBodies(fetchMock)).toEqual([]);
    const confirmation = reviewOffer();
    fireEvent.keyDown(confirmation, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Confirm fish sale' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review offer' })).toHaveFocus());
    expect(postBodies(fetchMock)).toEqual([]);
    expect(prepareCashRegisterSound).not.toHaveBeenCalled();
    expect(playCashRegisterSound).not.toHaveBeenCalled();
    reviewOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sale' }));
    expect(await screen.findByRole('heading', { name: 'Deal made' })).toHaveFocus();
    expect(screen.getByText('+15')).toBeTruthy();
    expect(onCharacter).toHaveBeenCalledWith({ credits: 265 });
    expect(onInventoryChange).toHaveBeenCalledOnce();
    expect(playCashRegisterSound).toHaveBeenCalledOnce();
    expect(postBodies(fetchMock)).toEqual([
      { stackId: 'a'.repeat(32), specimenIds: ['c'.repeat(32)], requestKey: 'sale-request-1234' },
    ]);
  });

  it('sells the complete selected stack and returns to remaining fish after the receipt', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (path: string) =>
        path === '/api/fish-buyer' ? response({ buyer }) : afterSale(24),
      );
    const { onCharacter, props, rerender } = setup(fetchMock);
    await appraiseMackerel();
    fireEvent.click(screen.getByRole('button', { name: 'Ordinary only' }));
    fireEvent.click(screen.getByRole('button', { name: 'All fish' }));
    reviewOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sale' }));
    await screen.findByRole('heading', { name: 'Deal made' });
    expect(screen.getByText('+24')).toBeTruthy();
    expect(onCharacter).toHaveBeenCalledWith({ credits: 274 });
    expect(playCashRegisterSound).toHaveBeenCalledOnce();
    expect(postBodies(fetchMock)).toEqual([
      {
        stackId: 'a'.repeat(32),
        specimenIds: expect.arrayContaining(['b'.repeat(32), 'c'.repeat(32)]),
        requestKey: 'sale-request-1234',
      },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Trade more fish' }));
    expect(screen.queryByRole('heading', { name: 'Deal made' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Appraise Mackerel stack 1' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Appraise Sardine stack/ })).toBeTruthy();
    rerender(<FishBuyerPanel {...props} />);
    expect(playCashRegisterSound).toHaveBeenCalledOnce();
  });

  it('reuses the original request key and selection when retrying an uncertain sale', async () => {
    let attempts = 0;
    const fetchMock = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/api/fish-buyer') return response({ buyer });
      attempts += 1;
      if (attempts === 1) throw new TypeError('Failed to fetch');
      return afterSale(24);
    });
    const { onCharacter, onInventoryChange } = setup(fetchMock);
    await appraiseMackerel();
    reviewOffer();
    const confirmButton = screen.getByRole('button', { name: 'Confirm sale' });
    fireEvent.click(confirmButton);
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    const retry = await screen.findByRole('button', { name: 'Retry sale' });
    expect(playCashRegisterSound).not.toHaveBeenCalled();
    fireEvent.click(retry);
    await screen.findByRole('heading', { name: 'Deal made' });
    const bodies = postBodies(fetchMock);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
    expect(onCharacter).toHaveBeenCalledOnce();
    expect(onInventoryChange).toHaveBeenCalledOnce();
    expect(playCashRegisterSound).toHaveBeenCalledOnce();
  });

  it('clears a stale sale and refreshes the buyer instead of retrying unavailable fish', async () => {
    let offerLoads = 0;
    const fetchMock = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/api/fish-buyer') {
        offerLoads += 1;
        return response({ buyer: offerLoads === 1 ? buyer : { available: true, offers: [] } });
      }
      return response(
        {
          error: {
            code: 'FISH_UNAVAILABLE',
            message: 'The selected fish are no longer available.',
          },
        },
        false,
      );
    });
    const { onCharacter } = setup(fetchMock);
    await appraiseMackerel();
    reviewOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sale' }));
    await waitFor(() => expect(offerLoads).toBe(2));
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Confirm fish sale' })).toBeNull(),
    );
    expect(screen.queryByRole('button', { name: 'Retry sale' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Appraise Mackerel stack 1' })).toBeNull();
    expect(onCharacter).not.toHaveBeenCalled();
    expect(postBodies(fetchMock)).toHaveLength(1);
    expect(playCashRegisterSound).not.toHaveBeenCalled();
  });

  it('retains uncertain-sale recovery even when a refresh shows all sold fish gone', async () => {
    let offerLoads = 0;
    let saleAttempts = 0;
    const fetchMock = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/api/fish-buyer') {
        offerLoads += 1;
        return response({ buyer: offerLoads === 1 ? buyer : { available: true, offers: [] } });
      }
      saleAttempts += 1;
      if (saleAttempts === 1) throw new TypeError('Failed to fetch');
      return response({
        buyer: { available: true, offers: [] },
        creditsEarned: 24,
        character: { credits: 274 },
      });
    });
    const { rerender, props, onCharacter } = setup(fetchMock);
    await appraiseMackerel();
    reviewOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sale' }));
    await screen.findByRole('button', { name: 'Retry sale' });
    expect(screen.getByRole('button', { name: 'Keep fish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Appraise Sardine stack/ })).toBeDisabled();
    rerender(<FishBuyerPanel {...props} refreshRevision={1} />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Appraise Mackerel stack 1' })).toBeNull(),
    );
    expect(playCashRegisterSound).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry sale' }));
    expect(await screen.findByRole('heading', { name: 'Deal made' })).toBeTruthy();
    expect(onCharacter).toHaveBeenCalledWith({ credits: 274 });
    const bodies = postBodies(fetchMock);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(playCashRegisterSound).toHaveBeenCalledOnce();
  });

  it('reconciles an open offer when an inventory refresh removes the selected stack', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ buyer }))
      .mockResolvedValue(response({ buyer: { available: true, offers: [buyer.offers[1]] } }));
    const { rerender, props } = setup(fetchMock);
    await appraiseMackerel();
    reviewOffer();
    rerender(<FishBuyerPanel {...props} refreshRevision={1} />);
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Appraise Mackerel' })).toBeNull(),
    );
    expect(screen.queryByRole('group', { name: 'Confirm fish sale' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Appraise Sardine stack/ })).toBeTruthy();
    expect(postBodies(fetchMock)).toEqual([]);
    expect(playCashRegisterSound).not.toHaveBeenCalled();
  });

  it('blocks selection and repeated submission until an in-flight sale settles', async () => {
    let finishSale!: (value: ReturnType<typeof response>) => void;
    const pendingSale = new Promise<ReturnType<typeof response>>((resolve) => {
      finishSale = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementation(async (path: string) =>
        path === '/api/fish-buyer' ? response({ buyer }) : pendingSale,
      );
    setup(fetchMock);
    await appraiseMackerel();
    reviewOffer();
    const confirmButton = screen.getByRole('button', { name: 'Confirm sale' });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    expect(screen.getByRole('button', { name: /^Appraise Sardine stack/ })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Deselect Mackerel, 0.750 kg, Trophy' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep fish' })).toBeDisabled();
    expect(postBodies(fetchMock)).toHaveLength(1);
    expect(prepareCashRegisterSound).toHaveBeenCalledOnce();
    expect(playCashRegisterSound).not.toHaveBeenCalled();
    await act(async () => finishSale(afterSale(24)));
    expect(await screen.findByRole('heading', { name: 'Deal made' })).toBeTruthy();
    expect(postBodies(fetchMock)).toHaveLength(1);
    expect(playCashRegisterSound).toHaveBeenCalledOnce();
  });

  it('stays silent if a pending sale finishes after leaving the buyer panel', async () => {
    let finishSale!: (value: ReturnType<typeof response>) => void;
    const pendingSale = new Promise<ReturnType<typeof response>>((resolve) => {
      finishSale = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementation(async (path: string) =>
        path === '/api/fish-buyer' ? response({ buyer }) : pendingSale,
      );
    const { unmount, onCharacter } = setup(fetchMock);
    await appraiseMackerel();
    reviewOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sale' }));
    expect(prepareCashRegisterSound).toHaveBeenCalledOnce();
    unmount();
    await act(async () => finishSale(afterSale(24)));
    expect(playCashRegisterSound).not.toHaveBeenCalled();
    expect(onCharacter).not.toHaveBeenCalled();
  });

  it('offers a usable retry after the initial quote request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(response({ buyer }));
    setup(fetchMock);
    const refresh = await screen.findByRole('button', { name: 'Refresh offers' });
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(refresh);
    expect(await screen.findByRole('button', { name: 'Appraise Mackerel stack 1' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(postBodies(fetchMock)).toEqual([]);
    expect(prepareCashRegisterSound).not.toHaveBeenCalled();
    expect(playCashRegisterSound).not.toHaveBeenCalled();
  });
});
