import * as React from "react";
import { cn } from "../../lib/utils";

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
      <div className="relative">
        <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-muted" />
        <ol className="relative z-10 flex justify-between">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <li key={step.id} className="flex flex-col items-center">
                <button
                  type="button"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-primary/80 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                    onStepClick ? "cursor-pointer" : "cursor-default"
                  )}
                  onClick={() => onStepClick?.(index)}
                  disabled={!onStepClick}
                >
                  {isCompleted ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </button>
                <div className="mt-2 hidden md:block">
                  <div
                    className={cn(
                      "text-xs font-medium",
                      isActive || isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </div>
                  {step.description && (
                    <div className="text-xs text-muted-foreground">
                      {step.description}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="md:hidden">
        <div
          className={cn(
            "text-sm font-medium",
            "text-foreground"
          )}
        >
          Step {currentStep + 1}: {steps[currentStep].title}
        </div>
        {steps[currentStep].description && (
          <div className="text-xs text-muted-foreground">
            {steps[currentStep].description}
          </div>
        )}
      </div>
    </div>
  );
}

export function WizardContent({
  children,
  className,
}: WizardContentProps) {
  return (
    <div className={cn("mt-4", className)}>
      {children}
    </div>
  );
}

export function WizardNavigation({
  children,
  className,
}: WizardNavigationProps) {
  return (
    <div className={cn("mt-8", className)}>
      {children}
    </div>
  );
}

