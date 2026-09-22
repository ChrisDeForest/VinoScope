const CHARACTERISTIC_MAX = 5;

export function CharacteristicBar({ label, value }: { label: string; value: number | null }) {
  const percent = value === null ? 0 : (value / CHARACTERISTIC_MAX) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-muted w-20">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-ink-muted w-16 text-right">
        {value === null ? "Not rated" : `${value}/5`}
      </span>
    </div>
  );
}
