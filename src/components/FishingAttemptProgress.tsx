import { useId } from 'react';
import type { FishingState } from '../../server/fishing';

interface FishingAttemptProgressProps {
  progress: number;
  phase: 'waiting' | 'checking' | 'reconnecting';
  randomEvent?: FishingState['randomEvent'];
  eventRemainingMs?: number;
  eventPending?: boolean;
  eventDisabled?: boolean;
  eventNotice?: string;
  eventError?: string;
  onEvent?: (eventId: string) => void;
}

export function FishingAttemptProgress({
  progress,
  phase,
  randomEvent,
  eventRemainingMs = 0,
  eventPending = false,
  eventDisabled = false,
  eventNotice = '',
  eventError = '',
  onEvent,
}: FishingAttemptProgressProps) {
  const descriptionId = useId();
  const fraction = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const percentage = Math.round(fraction * 100);
  const visibleEvent = randomEvent && eventRemainingMs > 0 ? randomEvent : null;
  const eventFraction = visibleEvent
    ? Math.min(1, Math.max(0, eventRemainingMs / visibleEvent.windowMs))
    : 0;
  const status =
    phase === 'reconnecting'
      ? 'Connection interrupted'
      : phase === 'checking'
        ? 'Checking for a bite…'
        : (visibleEvent?.message ?? 'Waiting for a bite…');

  return (
    <div className={`fishing-attempt-progress is-${phase}`}>
      <div
        className="fishing-attempt-ring"
        role="progressbar"
        aria-label="Current fishing attempt"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={`${percentage}%${phase === 'reconnecting' ? ', awaiting server confirmation' : phase === 'checking' ? ', checking for a bite' : ''}`}
        aria-describedby={descriptionId}
      >
        <svg viewBox="0 0 160 160" aria-hidden="true" focusable="false">
          <circle className="fishing-attempt-track" cx="80" cy="80" r="66" />
          <circle
            className="fishing-attempt-fill"
            cx="80"
            cy="80"
            r="66"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - fraction * 100}
            opacity={fraction > 0 ? 1 : 0}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <span className="fishing-attempt-fish" aria-hidden="true" />
      </div>
      <p
        className={`fishing-attempt-status${visibleEvent && phase === 'waiting' ? ' has-reel-prompt' : ''}`}
        role="status"
        aria-atomic="true"
      >
        {status}
      </p>
      {visibleEvent && (
        <div className="fishing-reel-prompt">
          <div className="fishing-reel-timer-caption" aria-hidden="true">
            <span>Reel window</span>
            <span>{Math.ceil(eventRemainingMs / 1000)}s</span>
          </div>
          <div
            className="fishing-reel-timer"
            role="progressbar"
            aria-label="Reel Pull time remaining"
            aria-valuemin={0}
            aria-valuemax={visibleEvent.windowMs / 1000}
            aria-valuenow={Math.ceil(eventRemainingMs / 1000)}
            aria-valuetext={`${(eventRemainingMs / 1000).toFixed(1)} seconds remaining`}
          >
            <span style={{ width: `${eventFraction * 100}%` }} />
          </div>
          <button
            type="button"
            className="button primary fishing-random-event-action"
            disabled={eventPending || eventDisabled || phase !== 'waiting'}
            onClick={() => onEvent?.(visibleEvent.id)}
          >
            {eventPending ? 'Confirming…' : visibleEvent.buttonLabel}
          </button>
        </div>
      )}
      {eventNotice && !visibleEvent && phase === 'waiting' && (
        <p className="fishing-random-event-feedback" role="status">
          {eventNotice}
        </p>
      )}
      {eventError && (
        <p className="fishing-random-event-error" role="alert">
          {eventError}
        </p>
      )}
      {phase === 'reconnecting' && (
        <p className="fishing-attempt-reconnect">
          Progress paused until the server confirms your session.
        </p>
      )}
      <p className="fishing-attempt-bait" id={descriptionId}>
        Each attempt consumes 1 bait.
      </p>
    </div>
  );
}
