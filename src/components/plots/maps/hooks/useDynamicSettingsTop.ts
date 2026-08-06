import { useState, useRef, useEffect } from 'react';

/**
 * Custom hook to dynamically calculate the top position of the settings gear button.
 * If a card title element exists, the button is centered vertically in the middle of that title row.
 * Otherwise, it falls back to header centering or top padding inside the card container.
 *
 * @param defaultTop - Fallback top offset in pixels if no card header/title exists (default: 6)
 * @param buttonHeight - The outer height of the gear button in pixels for vertical centering (default: 32)
 * @returns An object containing `containerRef` to attach to the root container and `settingsTop` in pixels.
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
