import { useEffect, useRef, type ReactNode } from "react";

export interface QuizStep {
  id: string;
  question: string;
  hint?: string;
  /** Shown on this step's chip once it has been answered. */
  summary: string;
  content: ReactNode;
}

export function QuizStage({
  steps,
  current,
  onJump,
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  disabled = false,
}: {
  steps: QuizStep[];
  current: number;
  onJump: (index: number) => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  /** Locks the answer chips and Back (e.g. while a request is in flight). */
  disabled?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownRef = useRef(current);

  // Move focus to the new question when the step changes (not on first render),
  // so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (shownRef.current === current) return;
    shownRef.current = current;
    headingRef.current?.focus();
  }, [current]);

  const step = steps[current];

  return (
    <section aria-label="Questionnaire" className="relative flex min-h-[32rem] flex-col rounded-lg bg-surface-raised px-4 pb-16 pt-16 sm:px-10">
      {current > 0 ? (
        <nav aria-label="Your answers" className="absolute inset-x-0 top-3 flex flex-wrap justify-center gap-1.5 px-3">
          {steps.slice(0, current).map((answered, index) => (
            <button
              key={answered.id}
              type="button"
              onClick={() => onJump(index)}
              disabled={disabled}
              className="rounded-full border border-surface-border px-3 py-1 text-xs text-ink-muted hover:border-accent hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
            >
              <span className="sr-only">Change answer: {answered.question} </span>
              {answered.summary}
            </button>
          ))}
        </nav>
      ) : null}

      <div key={step.id} className="quiz-rise flex flex-1 flex-col items-center justify-center text-center">
        <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl leading-tight text-ink focus:outline-none sm:text-4xl">
          {step.question}
        </h2>
        {step.hint ? <p id={`quiz-hint-${step.id}`} className="mt-2 max-w-xl text-sm text-ink-muted sm:text-base">{step.hint}</p> : null}
        <div className="mt-6 flex w-full justify-center">{step.content}</div>
        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled}
          className="mt-7 rounded-lg bg-accent px-7 py-3 text-sm font-bold text-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
        >
          {continueLabel}
        </button>
      </div>

      {current > 0 ? (
        <button
          type="button"
          onClick={() => onJump(current - 1)}
          disabled={disabled}
          className="absolute bottom-4 left-5 rounded text-sm text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          ← Back
        </button>
      ) : null}
      <p className="absolute bottom-4 right-5 text-xs text-ink-muted">
        Question {current + 1} of {steps.length}
      </p>
    </section>
  );
}
