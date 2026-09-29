import '../trophy-badge.css';

export function TrophyBadge({ label = 'Trophy' }: { label?: string }) {
  return (
    <span className="trophy-badge">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H4v3a4 4 0 0 0 4 4m9-7h3v3a4 4 0 0 1-4 4M12 14v5m-4 2h8m-7-2h6" />
      </svg>
      {label}
    </span>
  );
}
