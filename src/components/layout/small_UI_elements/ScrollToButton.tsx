"use client";
import { Button } from '@/components/ui/button';
import {SquareChevronDown, SquareChevronUp} from "lucide-react"
import { useTranslations } from 'next-intl';


/**
 * DOM anchor identifier targeted by a smooth-scroll control.
 *
 * @example
 * ```ts
 * const props: ScrollToTopButtonProps = { scrollToAnchor: "features" };
 * ```
 */
interface ScrollToTopButtonProps {
  /** ID of the existing DOM element to scroll into view. */
  scrollToAnchor: string;
}

/**
 * Shows an upward control that scrolls to an existing DOM anchor.
 *
 * @param scrollToAnchor - Target element ID, such as `features`.
 * @returns A localized smooth-scroll button.
 * @remarks The click handler performs no scroll when the target is absent.
 */
const ScrollToButtonUp: React.FC<ScrollToTopButtonProps> = ({ scrollToAnchor }) => {
const t = useTranslations("component_scrollToButton");
  return (
    <Button
      variant="outline"
      className="shrink-0 p-2 bg-gray-100 text-sm rounded-lg hover:bg-gray-300 transition-colors duration-200"
      onClick={() => {
        const mapElem = document.getElementById(scrollToAnchor);
        if (mapElem) {
          const y = mapElem.getBoundingClientRect().top;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }}
    >
      <SquareChevronUp className="w-4 h-4 text-gray-600 mr-1" /> {t.rich('buttontext')}
    </Button>
  );
};

/**
 * Shows a downward control that scrolls to an existing DOM anchor.
 *
 * @param scrollToAnchor - Target element ID, such as `showcases`.
 * @returns A localized smooth-scroll button.
 * @remarks The click handler performs no scroll when the target is absent.
 */
const ScrollToButtonDown: React.FC<ScrollToTopButtonProps> = ({ scrollToAnchor }) => {
const t = useTranslations("component_scrollToButton");
  return (
    <Button
      variant="outline"
      className="shrink-0 p-2 bg-gray-100 text-sm rounded-lg hover:bg-gray-300 transition-colors duration-200"
      onClick={() => {
        const mapElem = document.getElementById(scrollToAnchor);
        if (mapElem) {
          const y = mapElem.getBoundingClientRect().top;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }}
    >
      <SquareChevronDown className="w-4 h-4 text-gray-600 mr-1" /> {t.rich('buttontext')}
    </Button>
  );
};

/** Public smooth-scroll controls for navigating between Vis. Interface sections. */
export { ScrollToButtonUp, ScrollToButtonDown };
