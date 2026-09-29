import { useId, useState } from 'react';
import type { Character } from '../../server/character';
import type { InventoryItem } from '../../server/inventory';
import '../item-tooltip.css';

type Action = 'use' | 'equip' | 'unequip' | 'transfer';

function itemCategory(item: InventoryItem) {
  if (item.specimens) return 'Fish';
  if (item.id.endsWith('_bait')) return 'Bait';
  if (item.id.endsWith('_fishing_rod')) return 'Fishing rod';
  if (item.equipmentSlot) return `${item.equipmentSlot} equipment`;
  return item.kind;
}

function FallbackIcon({ item }: { item: InventoryItem }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {item.id === 'bandage' ? (
        <>
          <rect x="7" y="3" width="10" height="18" rx="3" transform="rotate(40 12 12)" />
          <path d="M10 10h4v4h-4z" />
        </>
      ) : item.equipmentSlot ? (
        <path d="m8 4 4 2 4-2 5 5-3 3-2-2v10H8V10l-2 2-3-3 5-5Zm4 2v14" />
      ) : item.kind === 'tool' ? (
        <>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <path d="M8 8V4h8v4M3 13h18M10 12v3h4v-3" />
        </>
      ) : (
        <>
          <path d="M6 5h12l2 15H4L6 5ZM8 5V3h8v2" />
          <path d="M9 11h6M9 15h6" />
        </>
      )}
    </svg>
  );
}

export function InventoryItemDetails({
  item,
  character,
  full,
  carriedItems,
  busy,
  act,
  onViewFish,
  onClose,
}: {
  item: InventoryItem;
  character: Character;
  full: boolean;
  carriedItems: InventoryItem[];
  busy: boolean;
  act: (action: Action, item: InventoryItem, quantity?: number) => Promise<void>;
  onViewFish: () => void;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState('1');
  const [transferOpen, setTransferOpen] = useState(false);
  const id = useId();
  const count = Number(quantity);
  const valid = Number.isSafeInteger(count) && count >= 1 && count <= item.quantity;
  const stored = item.location === 'locker';
  const fullHealth = character.hp >= character.maxHp;
  const mergeAvailable =
    stored &&
    item.stackable &&
    valid &&
    (item.specimens
      ? carriedItems
          .filter((candidate) => candidate.id === item.id && !candidate.equipped)
          .reduce((space, candidate) => space + candidate.maxStack - candidate.quantity, 0) >= count
      : carriedItems.some(
          (candidate) =>
            candidate.id === item.id &&
            !candidate.equipped &&
            candidate.quantity + count <= candidate.maxStack,
        ));
  const blocked = stored ? full && !mergeAvailable : item.equipped;
  const useHint = stored
    ? 'Take into your inventory to use.'
    : fullHealth
      ? 'Already at full health.'
      : `Health: ${character.hp} / ${character.maxHp} HP`;
  const equipHint = stored
    ? 'Take into your inventory to equip.'
    : item.equipped
      ? 'Unequip before storing.'
      : null;
  const transferHint = !valid
    ? `Choose a whole number from 1 to ${item.quantity}.`
    : blocked
      ? stored
        ? 'Your inventory is full. Store a carried item first.'
        : 'This item is equipped. Unequip it first.'
      : null;

  return (
    <section className="inventory-item-tooltip" aria-labelledby={`${id}-name`} aria-busy={busy}>
      <div className="item-tooltip-header">
        <div className="item-tooltip-icon">
          {item.artworkPath ? <img src={item.artworkPath} alt="" /> : <FallbackIcon item={item} />}
        </div>
        <div className="item-tooltip-title">
          <h3 id={`${id}-name`}>{item.name}</h3>
          <p className="item-tooltip-category">{itemCategory(item)}</p>
        </div>
        <button
          type="button"
          className="item-tooltip-close"
          aria-label="Close item details"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <p className={`item-tooltip-location${item.equipped ? ' is-equipped' : ''}`}>
        {stored ? 'New Harbor locker' : item.equipped ? '✓ Equipped' : 'In your pack'}
      </p>
      {item.healHp > 0 && (
        <p className="item-tooltip-effect">Use: Restores up to {item.healHp} HP.</p>
      )}
      <p className="item-tooltip-flavor">“{item.description}”</p>

      <div className="item-tooltip-actions">
        {item.specimens && (
          <button type="button" className="button primary" onClick={onViewFish}>
            Inspect fish <span aria-hidden="true">→</span>
          </button>
        )}
        {item.healHp > 0 && (
          <div className="item-tooltip-action-group">
            <p className="item-tooltip-hint" id={`${id}-use-hint`}>
              {useHint}
            </p>
            <button
              type="button"
              className="button primary"
              disabled={busy || stored || fullHealth}
              aria-describedby={`${id}-use-hint`}
              onClick={() => void act('use', item)}
            >
              Use one {item.id === 'bandage' ? 'bandage' : 'item'}
            </button>
          </div>
        )}
        {item.equipmentSlot && (
          <div className="item-tooltip-action-group">
            {equipHint && (
              <p className="item-tooltip-hint" id={`${id}-equip-hint`}>
                {equipHint}
              </p>
            )}
            <button
              type="button"
              className="button primary"
              disabled={busy || stored}
              aria-describedby={equipHint ? `${id}-equip-hint` : undefined}
              onClick={() => void act(item.equipped ? 'unequip' : 'equip', item)}
            >
              {item.equipped ? 'Unequip' : 'Equip item'}
            </button>
          </div>
        )}
        <button
          type="button"
          className="button secondary item-tooltip-transfer-toggle"
          aria-expanded={transferOpen}
          aria-controls={`${id}-transfer`}
          onClick={() => setTransferOpen(!transferOpen)}
        >
          {stored ? 'Take…' : 'Store…'}
          <span aria-hidden="true">{transferOpen ? '−' : '+'}</span>
        </button>
      </div>

      {transferOpen && (
        <form
          id={`${id}-transfer`}
          className="item-tooltip-transfer"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !blocked && !busy) void act('transfer', item, count);
          }}
        >
          {item.quantity > 1 && (
            <>
              <label htmlFor={`${id}-quantity`}>
                {stored ? 'Quantity to take' : 'Quantity to store'}
              </label>
              <div className="item-tooltip-quantity">
                <input
                  id={`${id}-quantity`}
                  className="input"
                  type="number"
                  min="1"
                  max={item.quantity}
                  step="1"
                  value={quantity}
                  disabled={busy}
                  aria-invalid={!valid}
                  aria-describedby={transferHint ? `${id}-transfer-hint` : undefined}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setQuantity(String(item.quantity))}
                >
                  All ({item.quantity})
                </button>
              </div>
            </>
          )}
          {transferHint && (
            <p className="item-tooltip-hint item-tooltip-warning" id={`${id}-transfer-hint`}>
              {transferHint}
            </p>
          )}
          <button
            type="submit"
            className="button primary"
            disabled={busy || blocked || !valid}
            aria-describedby={transferHint ? `${id}-transfer-hint` : undefined}
          >
            {stored ? 'Take into pack' : 'Store in locker'} <span aria-hidden="true">→</span>
          </button>
        </form>
      )}
    </section>
  );
}
