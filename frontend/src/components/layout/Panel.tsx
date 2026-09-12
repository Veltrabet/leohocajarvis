import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}

export default function Panel({ title, action, children, className, testId }: Props) {
  return (
    <section
      data-testid={testId}
      className={cn("q8-glass q8-bracket relative rounded-2xl p-5 md:p-6", className)}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="q8-overline">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
