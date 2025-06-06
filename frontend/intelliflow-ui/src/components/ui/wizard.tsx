import * as React from "react";
import { cn } from "../../lib/utils";
import { Check, ChevronRight } from "lucide-react";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  isComplete?: boolean;
  isActive?: boolean;
}

interface WizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export function Wizard({ steps, currentStep, onStepClick, className }: WizardProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* Progress bar */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
          <div
            className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-in-out"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isComplete = index < currentStep;
            const isActive = index === currentStep;
            
            return (
              <div
                key={step.id}
                className={cn(
                  "flex flex-col items-center",
                  (isComplete || isActive) ? "cursor-pointer" : "cursor-not-allowed"
                )}
                onClick={() => {
                  if (onStepClick && (isComplete || isActive)) {
                    onStepClick(index);
                  }
                }}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200",
                    isComplete
                      ? "border-primary bg-primary text-primary-foreground"
                      : isActive
                      ? "border-primary bg-background text-primary"
                      : "border-muted bg-background text-muted-foreground"
                  )}
                >
                  {isComplete ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 space-y-1 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isComplete
                        ? "text-primary"
                        : isActive
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground hidden md:block">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface WizardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function WizardContent({ children, className }: WizardContentProps) {
  return (
    <div className={cn("mt-8 animate-fade-in", className)}>
      {children}
    </div>
  );
}

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onComplete?: () => void;
  isNextDisabled?: boolean;
  isPreviousDisabled?: boolean;
  nextLabel?: string;
  previousLabel?: string;
  completeLabel?: string;
  className?: string;
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onComplete,
  isNextDisabled = false,
  isPreviousDisabled = false,
  nextLabel = "Next",
  previousLabel = "Previous",
  completeLabel = "Complete",
  className,
}: WizardNavigationProps) {
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className={cn("flex justify-between mt-8", className)}>
      <button
        type="button"
        onClick={onPrevious}
        disabled={isPreviousDisabled || currentStep === 0}
        className={cn(
          "px-4 py-2 text-sm font-medium rounded-md",
          currentStep === 0
            ? "text-muted-foreground cursor-not-allowed"
            : "text-primary hover:text-primary/80"
        )}
      >
        {previousLabel}
      </button>
      <button
        type="button"
        onClick={isLastStep ? onComplete : onNext}
        disabled={isNextDisabled}
        className={cn(
          "px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center space-x-1",
          isNextDisabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span>{isLastStep ? completeLabel : nextLabel}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

