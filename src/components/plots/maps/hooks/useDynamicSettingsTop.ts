import { useState, useRef, useEffect } from 'react';

/**
 * Dynamically computes the vertical pixel offset (`top`) for positioning the map settings gear button.
 *
 * Traverses up the DOM to find the parent dashboard card (`.cardWrapper` or `[data-swapy-slot]`), inspects header element bounding rectangles,
 * and centers the gear button relative to the card title row.
 *
 * @param defaultTop - Fallback pixel offset if no header or title element is found. @default 6
 * @param buttonHeight - Outer pixel height of the gear button for vertical centering calculations. @default 32
 * @returns Object containing `containerRef` to attach to the map root container and computed `settingsTop` pixel offset.
 *
 * @remarks
 * In multi-view dashboard grid layouts, cards may have varying header heights, badges, or title rows. Hardcoding absolute pixel offsets
 * causes the gear button to misalign with card headers. Using a `ResizeObserver` on the parent card wrapper guarantees seamless vertical alignment
 * during dynamic container resizes or dynamic card expansions.
 *
 * @example
 * ```tsx
 * const { containerRef, settingsTop } = useDynamicSettingsTop(6, 32);
 * return (
 *   <div ref={containerRef} className="relative size-full">
 *     <div className="absolute right-14 z-600" style={{ top: `${settingsTop}px` }}>
 *       <button className="p-1 rounded-full bg-black"><Settings /></button>
 *     </div>
 *   </div>
 * );
 * ```
 */
export function useDynamicSettingsTop(defaultTop: number = 6, buttonHeight: number = 32) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [settingsTop, setSettingsTop] = useState<number>(defaultTop);

    useEffect(() => {
        const updatePosition = () => {
            if (!containerRef.current) return;
            const cardWrapper = containerRef.current.closest('.cardWrapper') || containerRef.current.closest('[data-swapy-slot]');
            if (cardWrapper) {
                // Try to target the title row first (flex container holding CardTitle or header title element)
                const titleEl = cardWrapper.querySelector('.flex.items-center.justify-between') ||
                                cardWrapper.querySelector('[class*="CardTitle"]') ||
                                cardWrapper.querySelector('.text-2xl');
                
                const headerEl = cardWrapper.querySelector('.border-b') || cardWrapper.querySelector('header');
                const containerRect = containerRef.current.getBoundingClientRect();
                
                if (titleEl && titleEl.getBoundingClientRect().height > 0) {
                    const titleRect = titleEl.getBoundingClientRect();
                    const titleCenterY = titleRect.top + (titleRect.height / 2);
                    const computedTop = (titleCenterY - containerRect.top) - (buttonHeight / 2);
                    setSettingsTop(computedTop);
                } else if (headerEl && headerEl.getBoundingClientRect().height > 0) {
                    const headerRect = headerEl.getBoundingClientRect();
                    const headerCenterY = headerRect.top + (headerRect.height / 2);
                    const computedTop = (headerCenterY - containerRect.top) - (buttonHeight / 2);
                    setSettingsTop(computedTop);
                } else {
                    const cardRect = cardWrapper.getBoundingClientRect();
                    const computedTop = (cardRect.top - containerRect.top) + defaultTop;
                    setSettingsTop(computedTop);
                }
            } else {
                setSettingsTop(defaultTop);
            }
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);

        let observer: ResizeObserver | null = null;
        if (containerRef.current) {
            const cardWrapper = containerRef.current.closest('.cardWrapper') || containerRef.current.closest('[data-swapy-slot]');
            if (cardWrapper && typeof ResizeObserver !== 'undefined') {
                observer = new ResizeObserver(() => {
                    updatePosition();
                });
                observer.observe(cardWrapper);
            }
        }

        return () => {
            window.removeEventListener('resize', updatePosition);
            if (observer) observer.disconnect();
        };
    }, [defaultTop, buttonHeight]);

    return { containerRef, settingsTop };
}

