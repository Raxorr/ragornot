import { retrievalModes, type RetrievalMode } from "@/lib/config";

interface ModeSelectorProps {
  mode: RetrievalMode;
  onChange: (mode: RetrievalMode) => void;
}

export default function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-text">Retrieval mode</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {retrievalModes.map((option) => {
          const descriptionId = `mode-description-${option.id}`;
          return (
            <label
              key={option.id}
              className="flex cursor-pointer flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors has-[:checked]:border-accent has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="retrieval-mode"
                  value={option.id}
                  checked={mode === option.id}
                  onChange={() => onChange(option.id)}
                  aria-label={option.label}
                  aria-describedby={descriptionId}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="font-medium text-text">{option.label}</span>
              </span>
              <span id={descriptionId} className="pl-6 text-sm text-text-muted">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
