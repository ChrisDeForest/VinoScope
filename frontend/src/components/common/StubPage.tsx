export function StubPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl text-ink mb-4">{title}</h1>
      <p className="text-ink-muted">{description}</p>
    </div>
  );
}
