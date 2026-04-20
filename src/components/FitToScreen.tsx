import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';

/**
 * FitToScreen wraps arbitrary content and scales it down so that it fits within the visible viewport
 * without introducing a vertical scrollbar. It recalculates on resize and content changes.
 */
const FitToScreen: React.FC<{ children: React.ReactNode } > = ({ children }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Compute available viewport space (minus the distance from top of viewport)
    const containerTop = container.getBoundingClientRect().top;
    const availableHeight = Math.max(window.innerHeight - containerTop - 8, 100);
    const availableWidth = container.clientWidth;

    // Measure unscaled content size
    const prevTransform = content.style.transform;
    content.style.transform = 'none';
    const contentWidth = content.scrollWidth || content.clientWidth || 1;
    const contentHeight = content.scrollHeight || content.clientHeight || 1;
    content.style.transform = prevTransform;

    // Determine scale, clamp to reasonable min to keep readability
    const nextScale = Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight);
    const clamped = Math.max(0.6, Number.isFinite(nextScale) ? nextScale : 1);
    setScale(clamped);
  }, []);

  useEffect(() => {
    updateScale();
    const ro = new ResizeObserver(() => updateScale());
    if (contentRef.current) ro.observe(contentRef.current);
    window.addEventListener('resize', updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [updateScale]);

  return (
    <Box ref={containerRef} w="100%" overflow="hidden">
      <Box
        ref={contentRef}
        transform={`scale(${scale})`}
        transformOrigin="top center"
        transition="transform 0.2s ease"
      >
        {children}
      </Box>
    </Box>
  );
};

export default FitToScreen;
