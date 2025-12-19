import { useEffect, useRef } from 'react';

export function useAutoScroll(dependencies: unknown[]) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, dependencies);

  return messagesEndRef;
}

