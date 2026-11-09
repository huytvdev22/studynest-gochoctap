import React, { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
}

const PULL_THRESHOLD = 65; // Khoảng cách kéo (px) để kích hoạt làm mới

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const startYRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);

  useEffect(() => {
    const getScrollTop = () =>
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

    const isInsideScrollableModal = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      return Boolean(
        target.closest(
          '[role="dialog"], [data-modal], .modal-scroll-area, [data-prevent-pull-to-refresh="true"]'
        )
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Chỉ bắt đầu kéo nếu đang ở đỉnh trang, không ở trong modal và không đang làm mới
      if (getScrollTop() <= 2 && !isRefreshing && !isInsideScrollableModal(e.target)) {
        startYRef.current = e.touches[0].clientY;
        startXRef.current = e.touches[0].clientX;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - startYRef.current;
      const deltaX = Math.abs(currentX - startXRef.current);

      // Nếu người dùng đang vuốt ngang (ví dụ lật Flashcard, đổi tab), không kích hoạt pull-to-refresh
      if (deltaX > Math.abs(deltaY) && deltaX > 10) {
        isPullingRef.current = false;
        setPullDistance(0);
        return;
      }

      // Người dùng đang kéo từ trên xuống dưới khi đang ở đỉnh trang
      if (deltaY > 0 && getScrollTop() <= 2) {
        // Áp dụng hệ số giảm tốc (damping) để tạo lực cản tự nhiên như iOS
        const distance = Math.min(deltaY * 0.45, 100);
        setPullDistance(distance);

        // Ngăn chặn hành vi cuộn mặc định nếu đang kéo đủ rõ
        if (distance > 10 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current || isRefreshing) return;
      isPullingRef.current = false;

      if (pullDistance >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(PULL_THRESHOLD);

        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            // Mặc định reload lại trang nếu không truyền onRefresh cụ thể
            await new Promise((res) => setTimeout(res, 400));
            window.location.reload();
          }
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh]);

  const showIndicator = pullDistance > 0 || isRefreshing;

  return (
    <>
      {/* Vòng tròn thông báo Kéo để làm mới (Pull-to-refresh Indicator) */}
      <div
        aria-hidden={!showIndicator}
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-200 pointer-events-none ${
          showIndicator
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75 -translate-y-4'
        }`}
        style={{
          transform: showIndicator
            ? `translate(-50%, ${Math.max(0, pullDistance - 15)}px)`
            : undefined,
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/95 px-4 py-2 shadow-xl backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95">
          <RotateCw
            className={`h-4 w-4 text-emerald-600 dark:text-emerald-400 transition-transform ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={
              !isRefreshing
                ? { transform: `rotate(${pullDistance * 4.5}deg)` }
                : undefined
            }
          />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {isRefreshing
              ? 'Đang làm mới...'
              : pullDistance >= PULL_THRESHOLD
              ? 'Thả ra để làm mới'
              : 'Kéo xuống để làm mới'}
          </span>
        </div>
      </div>

      {children}
    </>
  );
}
