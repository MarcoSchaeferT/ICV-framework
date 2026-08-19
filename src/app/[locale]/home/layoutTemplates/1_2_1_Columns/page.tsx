"use client";

import React, { useRef, useEffect } from 'react';
import { InterfaceContextProvider, useInterfaceContext } from '@/components/contexts/InterfaceContext';
import SGridPlotCard from '@/components/layout/SwapyGridPlotCard';
import { CardPropsClass } from '@/components/layout/CardWrapper';
import { createSwapy, Swapy } from 'swapy';
import LinechartComponent, { LinechartProps } from '@/components/plots/linechart/linechart';
import BarchartComponent, { BarchartProps } from '@/components/plots/barchart/barchart';
import PieChartComponent, { PieChartProps } from '@/components/plots/piechart/piechart';
import { useUIContext } from '@/components/contexts/UIContext';
import SidebarRight from '@/components/layout/SidebarRight';
import { ChartDatasetProvider } from '@/components/contexts/ChartDatasetContext';

const isSWAPY = true;

/**
 * 1-2-1 Columns Dashboard Grid Layout Template Page.
 *
 * @returns Non-scrolling 1-2-1 vertical grid layout with interactive Swapy cards and a right sidebar chart registry.
 *
 * @remarks
 * Renders a full-width header card (`colSpan: 12`, `rowSpan: 4`), two split middle cards (`colSpan: 6` each, `rowSpan: 4`),
 * and a full-width footer card (`colSpan: 12`, `rowSpan: 4`). Sum of row spans equals 12.
 * A collapsible right sidebar provides a registry of chart preview cards that can be dragged into
 * the main grid via Swapy.
 *
 * @example
 * ```tsx
 * // Route: /[locale]/home/layoutTemplates/1_2_1_Columns
 * export default function Page121Columns() { ... }
 * ```
 */
export default function Page121Columns() {
  const UI_contextT = useUIContext();
  const layoutSizes = UI_contextT.layoutDims;

  // Initialize interface context
  useInterfaceContext();

  // Swapy drag and drop — shared container wrapping grid + sidebar
  const swapyRef = useRef<Swapy | null>(null);
  const swapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = swapContainerRef.current;
    if (isSWAPY && container) {
      swapyRef.current = createSwapy(container, {
        animation: 'dynamic',
        manualSwap: false,
        swapMode: 'hover',
        autoScrollOnDrag: true,
      });
      swapyRef.current?.enable(isSWAPY);

      return () => {
        swapyRef.current?.destroy();
      };
    }
  }, []);

  // Configure reusable row-oriented charts for user-selected datasets.
  const topLineProps = LinechartProps("121-top-linechart");
  topLineProps.dataMode = "generic";

  const midBarProps = BarchartProps("121-mid-barchart");
  midBarProps.dataMode = "generic";

  const midPieProps = PieChartProps("121-mid-piechart");
  midPieProps.dataMode = "generic";

  const botBarProps = BarchartProps("121-bot-barchart");
  botBarProps.dataMode = "generic";

  // Cards setup
  const cardTopProps = CardPropsClass("Card-121-Top", "Line Chart", "", "");
  const cardMid1Props = CardPropsClass("Card-121-Mid1", "Bar Chart", "", "");
  const cardMid2Props = CardPropsClass("Card-121-Mid2", "Pie Chart", "", "");
  const cardBotProps = CardPropsClass("Card-121-Bot", "Bar Chart", "", "");

  return (
    <main
      className="flex h-screen w-full overflow-hidden flex-col items-center justify-between"
      style={{ paddingTop: 0 }}
    >
      <InterfaceContextProvider>
        <ChartDatasetProvider>
        {/*** Shared Swapy container wrapping both grid and sidebar ***/}
        <div
          ref={swapContainerRef}
          className="flex w-full h-full"
        >
          {/*** Main Grid Area ***/}
          <div
            className="flex-1 grid grid-cols-12 md:grid-cols-12 pl-0 overflow-hidden"
            style={{
              gridTemplateRows: 'repeat(12, 1fr)',
              gap: `${layoutSizes.gapSize}px`,
              height: `calc(100vh - ${layoutSizes.gapSize * 2.5}px)`,
              paddingTop: `${layoutSizes.gapSize + 8}px`,
              paddingBottom: `${layoutSizes.gapSize}px`,
              paddingRight: `${layoutSizes.gapSize}px`,
              paddingLeft: `${layoutSizes.gapSize}px`,
            }}
          >
            {/*** Top Row (1 card, 12 cols, 4 rows span) ***/}
            <SGridPlotCard rowColSpan={[4, 12]} cardProps={cardTopProps}>
              <LinechartComponent chartProps={topLineProps} />
            </SGridPlotCard>

            {/*** Middle Row Left (6 cols, 4 rows span) ***/}
            <SGridPlotCard rowColSpan={[4, 6]} cardProps={cardMid1Props}>
              <BarchartComponent chartProps={midBarProps} />
            </SGridPlotCard>

            {/*** Middle Row Right (6 cols, 4 rows span) ***/}
            <SGridPlotCard rowColSpan={[4, 6]} cardProps={cardMid2Props}>
              <PieChartComponent ChartProps={midPieProps} />
            </SGridPlotCard>

            {/*** Bottom Row (1 card, 12 cols, 4 rows span) ***/}
            <SGridPlotCard rowColSpan={[4, 12]} cardProps={cardBotProps}>
              <BarchartComponent chartProps={botBarProps} />
            </SGridPlotCard>
          </div>

          {/*** Right Sidebar Chart Registry ***/}
          <SidebarRight pageId="121" swapyRef={swapyRef} />
        </div>
        </ChartDatasetProvider>
      </InterfaceContextProvider>
    </main>
  );
}
