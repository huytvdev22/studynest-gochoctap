import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { type AlertPayload, subscribeAlertDialog } from '@/lib/alertDialog';

export interface ModalDialogProps {
  open?: boolean;
  onClose: () => void;
  closedBy?: 'any' | 'closerequest' | 'none';
  placement?: 'center' | 'drawer-left';
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  children: React.ReactNode;
}

function isOutsideRect(clientX: number, clientY: number, rect: DOMRect): boolean {
  return (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  );
}

/**
 * ModalDialog chuẩn HTML `<dialog>` (Top Layer + showModal),
 * tự động bẫy focus, hỗ trợ Esc/closedby và chặn cuộn trang nền qua CSS :modal & ::backdrop.
 */
export function ModalDialog({
  open = true,
  onClose,
  closedBy = 'any',
  placement = 'center',
  ariaLabel,
  ariaLabelledBy,
  className = 'max-w-lg',
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointerDownOutsideRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [open]);

  const supportsClosedBy =
    typeof HTMLDialogElement !== 'undefined' &&
    'closedBy' in HTMLDialogElement.prototype;

  const handlePointerDown = (e: React.PointerEvent<HTMLDialogElement>) => {
    if (supportsClosedBy || closedBy !== 'any') return;
    const dialog = dialogRef.current;
    if (!dialog || e.target !== dialog) {
      pointerDownOutsideRef.current = false;
      return;
    }
    pointerDownOutsideRef.current = isOutsideRect(
      e.clientX,
      e.clientY,
      dialog.getBoundingClientRect()
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDialogElement>) => {
    if (supportsClosedBy || closedBy !== 'any') return;
    const wasOutside = pointerDownOutsideRef.current;
    pointerDownOutsideRef.current = false;
    if (!wasOutside) return;
    // Bỏ qua sự kiện bàn phím tổng hợp có tọa độ (0, 0)
    if (e.clientX === 0 && e.clientY === 0) return;

    const dialog = dialogRef.current;
    if (!dialog || e.target !== dialog) return;
    if (isOutsideRect(e.clientX, e.clientY, dialog.getBoundingClientRect())) {
      dialog.close();
    }
  };

  const basePlacementClass =
    placement === 'drawer-left'
      ? 'm-0 h-dvh max-h-dvh w-80 max-w-[85vw] border-0 bg-white p-4 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100'
      : 'm-auto w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-2.5rem)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto border-0 bg-transparent p-0 text-slate-900 shadow-none dark:text-slate-100';

  const closedByProp = { closedby: closedBy } as Record<string, unknown>;

  return (
    <dialog
      ref={dialogRef}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      {...closedByProp}
      onCancel={(e) => {
        if (closedBy === 'none') {
          e.preventDefault();
        }
      }}
      onClose={() => onCloseRef.current()}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={`${basePlacementClass} ${placement === 'center' ? className : className}`}
    >
      {children}
    </dialog>
  );
}

export function GlobalAlertDialogHost() {
  const [queue, setQueue] = useState<AlertPayload[]>([]);
  const headingId = useId();
  const descId = useId();

  useEffect(() => {
    return subscribeAlertDialog((payload) => {
      setQueue((prev) => [...prev, payload]);
    });
  }, []);

  const current = queue[0];
  if (!current) return null;

  return (
    <ModalDialog
      open={true}
      onClose={() => setQueue((prev) => prev.slice(1))}
      closedBy="any"
      ariaLabelledBy={headingId}
      className="max-w-md"
    >
      <div
        aria-describedby={descId}
        className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2
              id={headingId}
              className="text-base font-extrabold text-slate-900 dark:text-white"
            >
              {current.title}
            </h2>
            <p
              id={descId}
              className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
            >
              {current.message}
            </p>
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => setQueue((prev) => prev.slice(1))}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
