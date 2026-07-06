import { exampleQueries } from "@/lib/config";

interface ExampleChipsProps {
  onPick: (query: string) => void;
}

export default function ExampleChips({ onPick }: ExampleChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Example queries">
      {exampleQueries.map((query) => (
        <button
          key={query}
          type="button"
          onClick={() => onPick(query)}
          className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm text-text transition-colors hover:border-accent hover:text-accent-text"
        >
          {query}
        </button>
      ))}
    </div>
  );
}
