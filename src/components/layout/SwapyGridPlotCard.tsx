import React, { use, useLayoutEffect } from 'react';
import CardWrapper, { CardPropsClass } from './CardWrapper';
import styled, { keyframes, css } from 'styled-components';
import { Hand } from 'lucide-react';
import { useUIContext } from '../contexts/UIContext';
import { LoadingSpinnerProvider } from '../plots/maps/utils/loadingSpinner';

const StyledGridPlotCard = styled.div<{ rowSpan: number; colSpan: number; $glow?: boolean }>`
  background-color: gray;
  grid-row: span ${({ rowSpan }) => rowSpan};
  grid-column: span ${({ colSpan }) => colSpan};
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.3s ease-in-out;
  box-sizing: border-box;

  ${({ $glow }) => $glow && css`
    border: 2px solid rgba(124, 58, 237, 0.95);
    box-shadow: 0 0 12px rgba(124, 58, 237, 0.5);
    padding: 2px;
  `}
`;

/**
 * Props for one draggable dashboard-grid slot.
 *
 * @example
 * ```tsx
 * const props: Props = {
 *   children: <div id="albopictus-map" />,
 *   rowColSpan: [9, 4],
 *   cardProps: CardPropsClass(
 *     "albopictus-map-card",
 *     "Habitat suitability",
 *     "Aedes albopictus monthly mean",
 *     "Source: ICV",
 *   ),
 *   glow: false,
 * };
 * ```
 */
interface Props {
  /** Visualization, table, or documentation content hosted by the card. */
  children: React.ReactNode;
  /** Grid row span followed by grid column span. @default [1, 1] */
  rowColSpan?: [number, number]; // Tuple for [rowSpan, colSpan]
  /** Standard card presentation and identity. */
  cardProps: CardPropsClass;
  /** Whether to draw the visual attention border. @default false */
  glow?: boolean;
};

/**
 * Wraps a standard dashboard card in a Swapy-compatible grid slot and loading-task provider.
 *
 * @param props - Card content, span, presentation, and optional attention state.
 * @returns A draggable grid card whose handle is controlled by `UIContext.isSwapy`.
 *
 * @remarks
 * Each card establishes an independent `LoadingSpinnerProvider`, allowing its map or chart to aggregate multiple
 * asynchronous loading tasks without blocking unrelated cards.
 */
const SGridPlotCard: React.FC<Props> = ({
  children,
  rowColSpan = [1, 1], // Default to 1 row, 1 col span
  cardProps = {} as CardPropsClass,
  glow = false,
}: Props) => {
  const [rowSpan, colSpan] = rowColSpan;
  let c = useUIContext();

  return (
    <StyledGridPlotCard rowSpan={rowSpan} id={cardProps.id} colSpan={colSpan} data-swapy-slot={cardProps.id} className='relative' $glow={glow}>
      {/* Handle for swapping */}
      <div data-swapy-item={cardProps.id} className="size-full text-left flex flex-col min-h-0">
        {/* Handle icon */}
       
        <div
          className={`handle ${c.isSwapy ? "z-50" : "hidden"}  hover:bg-amber-400 border-3 hover:text-2xl border-blue-500 hover:text-amber-50 bg-slate-300 w-10 h-10 rounded-full flex items-center justify-center`}
          data-swapy-handle
          style={{
            position: "absolute",
            top: -12,
            right: -12,
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onMouseMove={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
        >
          <Hand className="w-7 h-7" />
        </div>
        {/* Card */}
        <LoadingSpinnerProvider>
        <CardWrapper cardProps={cardProps}>
          {children}
        </CardWrapper>
        </LoadingSpinnerProvider>
      </div>
    </StyledGridPlotCard>
  );
};

/** Default export for the Swapy-compatible dashboard grid card. */
export default SGridPlotCard;
