import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ModalPortal: Render các popup/modal trực tiếp vào document.body
 * để khắc phục triệt để lỗi bị kẹt stacking context (khiến thanh header trên cùng
 * không bị làm tối hoặc bị đè lớp).
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      setMounted(false);
    };
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
}

