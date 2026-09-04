import { Check, CheckCheck, Circle } from "lucide-react";

export type WynseMessageStatus = "sent" | "delivered" | "read";

export function WynseStatusIcon({ status }: { status: WynseMessageStatus }) {
  if (status === "read") {
    return <CheckCheck className="size-3 text-[#00f2ff]" aria-label="Read" />;
  }
  if (status === "delivered") {
    return <CheckCheck className="size-3 text-muted-foreground" aria-label="Delivered" />;
  }
  return <Check className="size-3 text-muted-foreground" aria-label="Sent" />;
}

export function WynseStatusDot({ status }: { status: WynseMessageStatus }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Circle
        className={`size-1.5 fill-current ${
          status === "read" ? "text-[#00f2ff]" : "text-muted-foreground"
        }`}
        aria-hidden="true"
      />
    </span>
  );
}
