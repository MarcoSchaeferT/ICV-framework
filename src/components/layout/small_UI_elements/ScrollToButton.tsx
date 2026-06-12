"use client";
import { Button } from '@/components/ui/button';
import {SquareChevronDown, SquareChevronUp} from "lucide-react"
import { useTranslations } from 'next-intl';


interface ScrollToTopButtonProps {
  scrollToAnchor: string;
}

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

export { ScrollToButtonUp, ScrollToButtonDown };