import { newsTopics, type NewsTopic } from "@/lib/news-types";

interface FilterBarProps {
  active: NewsTopic | "All";
  onChange: (topic: NewsTopic | "All") => void;
}

export default function FilterBar({ active, onChange }: FilterBarProps) {
  return (
    <div role="group" aria-label="Filter by topic" className="flex flex-wrap gap-2">
      {newsTopics.map((topic) => {
        const isActive = topic === active;
        return (
          <button
            key={topic}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(topic)}
            className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
              isActive
                ? "border-accent bg-accent text-white"
                : "border-border bg-surface text-text-muted hover:text-text"
            }`}
          >
            {topic}
          </button>
        );
      })}
    </div>
  );
}
