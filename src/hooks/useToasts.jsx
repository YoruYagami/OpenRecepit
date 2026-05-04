import { useState, useCallback } from 'react';
import { uid } from '../utils/formatters.js';

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "info") => {
    const id = uid();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return { toasts, push };
}
