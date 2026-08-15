import { cn } from "@/lib/utils";

/** The STRESS mark: two rings sharing one private overlap. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 24"
      aria-hidden="true"
      className={cn("h-6 w-10 text-primary", className)}
      fill="none"
    >
      <circle cx="14" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" opacity="0.9" />
      <circle cx="26" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" opacity="0.55" />
      <path
        d="M20 3.6a9 9 0 0 0 0 16.8A9 9 0 0 0 20 3.6Z"
        fill="currentColor"
        opacity="0.22"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark />
      <span className="font-display text-lg tracking-[0.24em] text-foreground">STRESS</span>
    </span>
  );
}
