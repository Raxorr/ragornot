"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { decodeAnswers, type Answers } from "./decide-logic";

// Owns the /decide answers so they (and the derived recommendation + share card)
// survive soft navigation and reset only on hard refresh. Hydrates once from the
// URL hash on app load so a shared /decide#… link reproduces the result; after
// that this context is the source of truth.

interface DecideStateValue {
  answers: Answers;
  setAnswer: (id: string, value: string) => void;
  reset: () => void;
}

const DecideStateContext = createContext<DecideStateValue | null>(null);

export function DecideStateProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<Answers>({});

  useEffect(() => {
    const fromUrl = decodeAnswers(window.location.hash);
    // One-time hydration from a browser-only source (the URL hash) on app load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Object.keys(fromUrl).length > 0) setAnswers(fromUrl);
  }, []);

  const setAnswer = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);
  const reset = useCallback(() => setAnswers({}), []);

  const value = useMemo<DecideStateValue>(
    () => ({ answers, setAnswer, reset }),
    [answers, setAnswer, reset],
  );

  return <DecideStateContext.Provider value={value}>{children}</DecideStateContext.Provider>;
}

export function useDecideState(): DecideStateValue {
  const ctx = useContext(DecideStateContext);
  if (!ctx) throw new Error("useDecideState must be used within DecideStateProvider");
  return ctx;
}
