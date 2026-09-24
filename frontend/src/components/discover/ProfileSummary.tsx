export function ProfileSummary({
  description,
  title = "Your Wine Profile",
}: {
  description: string[];
  title?: string;
}) {
  return (
    <div className="border border-surface-border rounded p-4">
      <h2 className="font-serif text-lg text-ink mb-2">{title}</h2>
      {description.length === 0 ? (
        <p className="text-ink-muted text-sm">
          No specific preferences set — showing all wines, sorted alphabetically.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {description.map((line, i) => (
            <li
              key={i}
              className="text-sm bg-surface-raised border border-surface-border rounded-full px-3 py-1 text-ink"
            >
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
