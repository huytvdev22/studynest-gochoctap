export interface AlertPayload {
  title: string;
  message: string;
}

type AlertListener = (payload: AlertPayload) => void;
const alertListeners = new Set<AlertListener>();

export function subscribeAlertDialog(listener: AlertListener): () => void {
  alertListeners.add(listener);
  return () => {
    alertListeners.delete(listener);
  };
}

/**
 * Hiển thị hộp thoại thông báo bằng `<dialog>` chuẩn thay cho `window.alert()`.
 */
export function showAlertDialog(message: string, title = 'Thông báo') {
  const payload: AlertPayload = { title, message };
  if (alertListeners.size === 0) {
    console.warn(`[StudyNest Notice] ${title}: ${message}`);
    return;
  }
  alertListeners.forEach((listener) => listener(payload));
}
