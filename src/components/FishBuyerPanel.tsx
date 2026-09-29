import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character } from '../../server/character';
import type { FishBuyerOffer, FishBuyerState } from '../../server/fishBuyer';
import { formatFishWeightKg } from '../../server/fishWeightFormat';
import { prepareCashRegisterSound } from '../audio/cashRegister';
import { TrophyBadge } from './TrophyBadge';
import '../fish-buyer.css';

interface SaleIntent {
  stackId: string;
  specimenIds: string[];
  credits: number;
  name: string;
  artworkPath?: string;
  trophyCount: number;
  requestKey: string;
  attempted: boolean;
}
interface Receipt {
  name: string;
  artworkPath?: string;
  count: number;
  trophyCount: number;
  credits: number;
}
class BuyerError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}
async function buyerRequest(path: string, body?: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(path, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
      : AbortSignal.timeout(10_000),
    ...(body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const payload = await response.json();
  if (!response.ok)
    throw new BuyerError(
      payload.error?.message ?? 'The buyer could not be reached.',
      payload.error?.code ?? 'REQUEST_FAILED',
    );
  return payload;
}

export function FishBuyerPanel({
  onCharacter,
  onInventoryChange,
  onOpenPack,
  refreshRevision,
}: {
  onCharacter: (character: Character) => void;
  onInventoryChange: () => void;
  onOpenPack?: (opener: HTMLButtonElement) => void;
  refreshRevision: number;
}) {
  const [buyer, setBuyer] = useState<FishBuyerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<{ stackId: string; ids: string[] } | null>(null);
  const [sale, setSale] = useState<SaleIntent | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const saleRef = useRef<SaleIntent | null>(null);
  const busyRef = useRef(false);
  const readVersion = useRef(0);
  const mounted = useRef(true);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  const stackHeading = useRef<HTMLHeadingElement>(null);

  const updateSale = useCallback((next: SaleIntent | null) => {
    saleRef.current = next;
    setSale(next);
  }, []);
  const applyBuyer = useCallback(
    (next: FishBuyerState) => {
      setBuyer(next);
      setSelection((previous) => {
        if (!previous) return null;
        const offer = next.offers.find((entry) => entry.stackId === previous.stackId);
        return offer
          ? {
              stackId: previous.stackId,
              ids: previous.ids.filter((id) => offer.specimens.some((fish) => fish.id === id)),
            }
          : null;
      });
      const intent = saleRef.current;
      if (intent && !intent.attempted) {
        const offer = next.offers.find((entry) => entry.stackId === intent.stackId);
        const specimens =
          offer?.specimens.filter((fish) => intent.specimenIds.includes(fish.id)) ?? [];
        if (
          specimens.length !== intent.specimenIds.length ||
          specimens.reduce((sum, fish) => sum + fish.credits, 0) !== intent.credits
        ) {
          updateSale(null);
          setError('Your catch changed. Review the refreshed offer.');
          requestAnimationFrame(() => reviewButton.current?.focus());
        }
      }
    },
    [updateSale],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const version = ++readVersion.current;
    void buyerRequest('/api/fish-buyer', undefined, controller.signal)
      .then((result: { buyer: FishBuyerState }) => {
        if (!controller.signal.aborted && version === readVersion.current) applyBuyer(result.buyer);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted && version === readVersion.current)
          setError(cause instanceof Error ? cause.message : 'Offers could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted && version === readVersion.current) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshRevision, reload, applyBuyer]);
  useEffect(() => {
    if (receipt) receiptHeading.current?.focus();
    else if (sale) confirmationHeading.current?.focus();
  }, [receipt, sale]);

  const active =
    buyer?.offers.find((offer) => offer.stackId === selection?.stackId) ?? buyer?.offers[0];
  const selected =
    active?.specimens.filter(
      (fish) => selection?.stackId !== active.stackId || selection.ids.includes(fish.id),
    ) ?? [];
  const total = selected.reduce((sum, fish) => sum + fish.credits, 0);
  const trophies = selected.filter((fish) => fish.trophy).length;
  const locked = busy || Boolean(sale?.attempted);
  const featured = [...selected].sort(
    (a, b) => Number(b.trophy) - Number(a.trophy) || (b.weightKg ?? 0) - (a.weightKg ?? 0),
  )[0];
  const catchCount = buyer?.offers.reduce((sum, offer) => sum + offer.specimens.length, 0) ?? 0;

  function chooseStack(offer: FishBuyerOffer) {
    if (locked) return;
    setSelection({ stackId: offer.stackId, ids: offer.specimens.map((fish) => fish.id) });
    updateSale(null);
    setReceipt(null);
    setError('');
  }
  function selectFish(ids: string[]) {
    if (!active || locked) return;
    setSelection({ stackId: active.stackId, ids });
    updateSale(null);
    setError('');
  }
  function reviewOffer() {
    if (!active || !selected.length || locked) return;
    setSelection({ stackId: active.stackId, ids: selected.map((fish) => fish.id) });
    updateSale({
      stackId: active.stackId,
      specimenIds: selected.map((fish) => fish.id),
      credits: total,
      name: active.name,
      artworkPath: active.artworkPath,
      trophyCount: trophies,
      requestKey: crypto.randomUUID(),
      attempted: false,
    });
    setError('');
  }
  function cancelSale() {
    if (locked) return;
    updateSale(null);
    setError('');
    requestAnimationFrame(() => reviewButton.current?.focus());
  }
  async function confirmSale() {
    const intent = saleRef.current;
    if (!intent || busyRef.current) return;
    busyRef.current = true;
    const playSaleSound = prepareCashRegisterSound();
    setBusy(true);
    setError('');
    updateSale({ ...intent, attempted: true });
    try {
      const result = (await buyerRequest('/api/fish-buyer/sell', {
        stackId: intent.stackId,
        specimenIds: intent.specimenIds,
        requestKey: intent.requestKey,
      })) as { creditsEarned: number; character: Character; buyer: FishBuyerState };
      if (!mounted.current) return;
      readVersion.current++;
      updateSale(null);
      applyBuyer(result.buyer);
      setLoading(false);
      setReceipt({
        name: intent.name,
        artworkPath: intent.artworkPath,
        count: intent.specimenIds.length,
        trophyCount: intent.trophyCount,
        credits: result.creditsEarned,
      });
      playSaleSound();
      onCharacter(result.character);
      onInventoryChange();
    } catch (cause) {
      if (!mounted.current) return;
      if (
        cause instanceof BuyerError &&
        [
          'FISH_UNAVAILABLE',
          'BUYER_UNAVAILABLE',
          'REQUEST_KEY_REUSED',
          'VALIDATION_ERROR',
          'CREDIT_LIMIT',
          'CHARACTER_NOT_FOUND',
        ].includes(cause.code)
      ) {
        updateSale(null);
        setError(cause.message);
        setLoading(true);
        setReload((value) => value + 1);
        requestAnimationFrame(() => reviewButton.current?.focus());
      } else setError('The trade could not be confirmed. Retry safely to check the same sale.');
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <section className="fish-buyer" aria-labelledby="fish-buyer-heading">
      <header className="fish-buyer-npc">
        <img className="fish-buyer-avatar" src="/assets/npcs/dockside-buyer.png" alt="" />
        <div>
          <p className="fish-buyer-kicker">Fishing Store</p>
          <h4 id="fish-buyer-heading">Dockside buyer</h4>
          <span className="fish-buyer-role">Fish merchant</span>
        </div>
      </header>
      <p className="fish-buyer-dialogue">
        {receipt
          ? '“A fine haul. Your credits are well earned.”'
          : trophies
            ? '“Now that’s a catch. I’ll pay extra for those Trophies.”'
            : '“Let’s see what the tide brought you.”'}
      </p>
      <div className="fish-buyer-content">
        {error && (
          <p className="fish-buyer-error" role="alert">
            {error}
          </p>
        )}
        {loading && !buyer && (
          <div className="fish-buyer-loading" role="status">
            The buyer is checking your catch…
          </div>
        )}
        {receipt ? (
          <section
            className={`fish-buyer-receipt${receipt.trophyCount ? ' is-trophy' : ''}`}
            aria-labelledby="buyer-receipt-heading"
          >
            <p className="fish-buyer-kicker">Trade complete</p>
            <h5 ref={receiptHeading} tabIndex={-1} id="buyer-receipt-heading">
              Deal made
            </h5>
            {receipt.artworkPath && <img src={receipt.artworkPath} alt="" />}
            <p className="fish-buyer-receipt-credits">
              <strong>+{receipt.credits.toLocaleString()}</strong>
              <span>credits earned</span>
            </p>
            <p>
              {receipt.count} {receipt.name} sold
            </p>
            {receipt.trophyCount > 0 && (
              <TrophyBadge
                label={`${receipt.trophyCount} ${receipt.trophyCount === 1 ? 'Trophy' : 'Trophies'} traded`}
              />
            )}
            <p className="sr-only" role="status">
              Sold {receipt.count} {receipt.name} for {receipt.credits} credits.
            </p>
            <button
              className="button primary"
              onClick={() => {
                setReceipt(null);
                setSelection(null);
                requestAnimationFrame(() => stackHeading.current?.focus());
              }}
            >
              Trade more fish
            </button>
          </section>
        ) : buyer && !buyer.offers.length ? (
          <div className="fish-buyer-empty">
            <h5 ref={stackHeading} tabIndex={-1}>
              Bring in your next haul
            </h5>
            <p>
              I buy Sardine, Mackerel, and Bluefin Tuna. Bring fish in your pack to get an offer.
            </p>
            <small>Fish in your locker? Take them into your pack first.</small>
            {onOpenPack && (
              <button
                className="button secondary"
                onClick={(event) => onOpenPack(event.currentTarget)}
              >
                Open inventory
              </button>
            )}
          </div>
        ) : buyer && active ? (
          <>
            <div className="fish-buyer-section-heading">
              <h5 ref={stackHeading} tabIndex={-1}>
                Your catch
              </h5>
              <span>{catchCount} fish</span>
            </div>
            <div className="fish-buyer-stacks" role="group" aria-label="Choose a fish stack">
              {buyer.offers.map((offer, index) => (
                <button
                  key={offer.stackId}
                  className={`fish-buyer-stack-choice${offer.stackId === active.stackId ? ' is-selected' : ''}${offer.specimens.some((fish) => fish.trophy) ? ' has-trophy' : ''}`}
                  aria-label={`Appraise ${offer.name} stack ${index + 1}`}
                  aria-pressed={offer.stackId === active.stackId}
                  disabled={locked}
                  onClick={() => chooseStack(offer)}
                >
                  <span className="fish-buyer-stack-count">×{offer.specimens.length}</span>
                  {offer.artworkPath && <img src={offer.artworkPath} alt="" />}
                  <strong>{offer.name}</strong>
                  <span className="fish-buyer-stack-price">{offer.totalCredits} Cr</span>
                  {offer.specimens.some((fish) => fish.trophy) && <TrophyBadge />}
                </button>
              ))}
            </div>
            <section
              className="fish-buyer-appraisal"
              aria-label={`Appraise ${active.name}`}
              key={active.stackId}
            >
              <div className={`fish-buyer-showcase${trophies ? ' is-trophy' : ''}`}>
                <div className="fish-buyer-showcase-label">
                  <span>On the counter</span>
                  {trophies > 0 && (
                    <TrophyBadge label={`${trophies} ${trophies === 1 ? 'Trophy' : 'Trophies'}`} />
                  )}
                </div>
                {active.artworkPath && <img src={active.artworkPath} alt="" />}
                <h5>{active.name}</h5>
                <p>
                  {selected.length === 1 && featured
                    ? featured.weightKg === null
                      ? 'Weight unknown'
                      : `${formatFishWeightKg(featured.weightKg)} kg`
                    : `${selected.length} of ${active.specimens.length} fish selected`}
                </p>
                <small>
                  {selected.length === 1 && featured?.creditsPerKg != null
                    ? `${featured.creditsPerKg.toFixed(2)} Cr/kg · Trophy offer`
                    : trophies
                      ? 'Trophies appraised by weight'
                      : 'A flat price for each ordinary fish'}
                </small>
              </div>
              <div className="fish-buyer-selection-heading">
                <span>Choose fish to sell</span>
                <div>
                  <button
                    disabled={locked}
                    onClick={() => selectFish(active.specimens.map((fish) => fish.id))}
                  >
                    All fish
                  </button>
                  {active.specimens.some((fish) => fish.trophy) && (
                    <button
                      disabled={locked}
                      onClick={() =>
                        selectFish(
                          active.specimens.filter((fish) => !fish.trophy).map((fish) => fish.id),
                        )
                      }
                    >
                      Ordinary only
                    </button>
                  )}
                </div>
              </div>
              <div
                className="fish-buyer-specimens"
                role="group"
                aria-label={`${active.name} specimens`}
              >
                {active.specimens.map((fish) => {
                  const included = selected.some((entry) => entry.id === fish.id);
                  return (
                    <button
                      key={fish.id}
                      className={`${included ? 'is-selected' : ''}${fish.trophy ? ' is-trophy' : ''}`}
                      aria-pressed={included}
                      aria-label={`${included ? 'Deselect' : 'Select'} ${active.name}, ${fish.weightKg === null ? 'weight unknown' : `${formatFishWeightKg(fish.weightKg)} kg`}${fish.trophy ? ', Trophy' : ''}`}
                      disabled={locked}
                      onClick={() =>
                        selectFish(
                          included
                            ? selected
                                .filter((entry) => entry.id !== fish.id)
                                .map((entry) => entry.id)
                            : [...selected.map((entry) => entry.id), fish.id],
                        )
                      }
                    >
                      <span className="fish-buyer-selection-mark" aria-hidden="true">
                        {included ? '✓' : '+'}
                      </span>
                      <strong>
                        {fish.weightKg === null
                          ? '— kg'
                          : `${formatFishWeightKg(fish.weightKg)} kg`}
                      </strong>
                      <span>{fish.credits} Cr</span>
                      {fish.trophy && <TrophyBadge />}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}
        {!sale && error && (
          <button
            className="button secondary fish-buyer-refresh"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setError('');
              setReload((value) => value + 1);
            }}
          >
            Refresh offers
          </button>
        )}
      </div>
      {!receipt && (active || sale) && (
        <footer className="fish-buyer-footer">
          {sale ? (
            <div
              role="group"
              aria-label="Confirm fish sale"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelSale();
                }
              }}
            >
              <h5 ref={confirmationHeading} tabIndex={-1}>
                Seal the deal?
              </h5>
              <p>
                {sale.specimenIds.length} {sale.name}
                {sale.trophyCount
                  ? ` · ${sale.trophyCount} ${sale.trophyCount === 1 ? 'Trophy' : 'Trophies'} included`
                  : ''}
              </p>
              <div className="fish-buyer-offer-total">
                <span>You receive</span>
                <strong>
                  {sale.credits.toLocaleString()} <small>Cr</small>
                </strong>
              </div>
              <div className="fish-buyer-confirm-actions">
                <button className="button secondary" disabled={locked} onClick={cancelSale}>
                  Keep fish
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void confirmSale()}
                >
                  {busy ? 'Trading…' : sale.attempted ? 'Retry sale' : 'Confirm sale'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="fish-buyer-offer-total">
                <div>
                  <span>The buyer offers</span>
                  <small>
                    {selected.length} fish
                    {trophies ? ` · ${trophies} ${trophies === 1 ? 'Trophy' : 'Trophies'}` : ''}
                  </small>
                </div>
                <strong>
                  {total.toLocaleString()} <small>Cr</small>
                </strong>
              </div>
              <button
                ref={reviewButton}
                className="button primary fish-buyer-review"
                disabled={!selected.length || loading || busy}
                onClick={reviewOffer}
              >
                Review offer <span aria-hidden="true">→</span>
              </button>
            </>
          )}
        </footer>
      )}
    </section>
  );
}
