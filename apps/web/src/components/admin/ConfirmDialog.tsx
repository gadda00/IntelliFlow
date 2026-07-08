'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

/**
 * Confirmation dialog for destructive actions (delete, deprecate, purge, ...).
 * Wraps shadcn/ui's AlertDialog with a consistent destructive style and a
 * controlled API that's easier to use from list pages.
 */

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-100">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-slate-100">
            {destructive && (
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={e => {
              e.preventDefault();
              void onConfirm();
            }}
            className={cn(
              destructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white',
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
