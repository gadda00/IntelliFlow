import React from "react";
import { cn } from "../../lib/utils";
import { Check } from "lucide-react";

interface WizardStep {
  id: string;
  title: string;
  description?: string;
}

interface WizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

interface WizardContentProps {
  children: React.ReactNode;
  className?: string;
}

interface WizardNavigationProps {
  children: React.ReactNode;
  className?: string;
}

export function Wizard({
  steps,
  currentStep,
  onStepClick,
  className,
}: WizardProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-center">
        <nav aria-label="Progress" className="w-full">
          <ol
            role="list"
            className="space-y-4 md:flex md:space-x-8 md:space-y-0"
          >
            {steps.map((step, index) => (
              <li key={step.id} className="md:flex-1">
                <div
                  className={cn(
                    "group flex flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4",
                    index < currentStep
                      ? "border-primary"
                      : index === currentStep
                      ? "border-primary"
                      : "border-muted-foreground/20"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-medium",
                      index < currentStep
                        ? "text-primary"
                        : index === currentStep
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <button
                      onClick={() => onStepClick && onStepClick(index)}
                      className={cn(
                        "flex items-center",
                        onStepClick ? "cursor-pointer" : "cursor-default"
                      )}
                      disabled={!onStepClick}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full mr-2">
                        {index < currentStep ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <span
                            className={cn(
                              "text-xs",
                              index === currentStep
                                ? "text-primary"
                                : "text-muted-foreground"
                            )}
                          >
                            {index + 1}
                          </span>
                        )}
                      </span>
                      {step.title}
                    </button>
                  </span>
                  {step.description && (
                    <span
                      className={cn(
                        "text-xs",
                        index <= currentStep
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60"
                      )}
                    >
                      {step.description}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  );
}

export function WizardContent({ children, className }: WizardContentProps) {
  return <div className={cn("mt-6", className)}>{children}</div>;
}

export function WizardNavigation({
  children,
  className,
}: WizardNavigationProps) {
  return <div className={cn("mt-6", className)}>{children}</div>;
}

