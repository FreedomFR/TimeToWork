/** Small square badge showing how many entries a grouped row contains. */
export default function CountBadge({ count }: { count: number }) {
  return (
    <span className="w-6 h-6 shrink-0 rounded bg-surfaceAlt text-muted text-xs font-medium flex items-center justify-center">
      {count}
    </span>
  );
}
