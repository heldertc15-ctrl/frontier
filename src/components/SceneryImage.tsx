import { useEffect, useState } from 'react';

interface DisplayedScene {
  currentSrc: string;
  previousSrc: string | null;
  revealed: boolean;
  durationMs: number;
  transitionGroup: string;
}

export function SceneryImage({
  src,
  alt,
  onError,
  durationMs = 1000,
  transitionGroup = '',
}: {
  src: string;
  alt: string;
  onError: (src: string) => void;
  durationMs?: number;
  transitionGroup?: string;
}) {
  const [scene, setScene] = useState<DisplayedScene>({
    currentSrc: src,
    previousSrc: null,
    revealed: true,
    durationMs,
    transitionGroup,
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setScene((shown) =>
        shown.currentSrc === src
          ? shown.transitionGroup === transitionGroup
            ? shown
            : { ...shown, transitionGroup }
          : {
              currentSrc: src,
              previousSrc: shown.revealed
                ? shown.currentSrc
                : (shown.previousSrc ?? shown.currentSrc),
              revealed: false,
              durationMs: shown.transitionGroup === transitionGroup ? durationMs : 120,
              transitionGroup,
            },
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [src, durationMs, transitionGroup]);

  useEffect(() => {
    if (!scene.previousSrc || !scene.revealed) return;
    const timer = window.setTimeout(() => {
      setScene((shown) =>
        shown.currentSrc === scene.currentSrc ? { ...shown, previousSrc: null } : shown,
      );
    }, scene.durationMs + 50);
    return () => window.clearTimeout(timer);
  }, [scene.currentSrc, scene.previousSrc, scene.revealed, scene.durationMs]);

  return (
    <>
      {scene.previousSrc && (
        <img
          className="scene-image scene-image-previous"
          src={scene.previousSrc}
          alt=""
          aria-hidden
        />
      )}
      <img
        className={`scene-image${scene.revealed ? ' is-revealed' : ''}${scene.revealed && scene.previousSrc ? ' scene-image-incoming' : ''}`}
        style={{ animationDuration: `${scene.durationMs}ms` }}
        src={scene.currentSrc}
        alt={alt}
        onLoad={() => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              setScene((shown) =>
                shown.currentSrc === src ? { ...shown, revealed: true } : shown,
              );
            });
          });
        }}
        onError={() => onError(scene.currentSrc)}
      />
    </>
  );
}
