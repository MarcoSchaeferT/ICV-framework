"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
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
 * 3 Columns Dashboard Grid Layout Template Page.
 *
 * @returns Non-scrolling 3-column vertical grid layout with interactive Swapy cards and a right sidebar chart registry.
 *
 * @remarks
 * Renders 3 equal-width vertical column slots in a 12-column grid system (`colSpan: 4` per card).
 * A collapsible right sidebar provides a registry of chart preview cards that can be dragged into
 * the main grid via Swapy. The sidebar and main grid share a common Swapy container so that
 * cross-container drag-and-drop works seamlessly.
 *
 * @example
 * ```tsx
 * // Route: /[locale]/home/layoutTemplates/3_Columns
 * export default function Page3Columns() { ... }
 * ```
 */
export default function Page3Columns() {
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
  const lineProps = LinechartProps("3col-linechart");
  lineProps.dataMode = "generic";

  const barProps = BarchartProps("3col-barchart");
  barProps.dataMode = "generic";

  const pieProps = PieChartProps("3col-piechart");
  pieProps.dataMode = "generic";

  // Cards setup
  const card1Props = CardPropsClass("Card-Col1", "Line Chart", "", "");
  const card2Props = CardPropsClass("Card-Col2", "Bar Chart", "", "");
  const card3Props = CardPropsClass("Card-Col3", "Pie Chart", "", "");

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
              paddingTop: `${layoutSizes.gapSize}px`,
              paddingBottom: `${layoutSizes.gapSize}px`,
              paddingRight: `${layoutSizes.gapSize}px`,
              paddingLeft: `${layoutSizes.gapSize}px`,
            }}
          >
            {/*** Grid Column 1 (4 cols, 12 rows span) ***/}
            <SGridPlotCard rowColSpan={[12, 4]} cardProps={card1Props}>
              <LinechartComponent chartProps={lineProps} />
            </SGridPlotCard>

            {/*** Grid Column 2 (4 cols, 12 rows span) ***/}
            <SGridPlotCard rowColSpan={[12, 4]} cardProps={card2Props}>
              <BarchartComponent chartProps={barProps} />
            </SGridPlotCard>

            {/*** Grid Column 3 (4 cols, 12 rows span) ***/}
            <SGridPlotCard rowColSpan={[12, 4]} cardProps={card3Props}>
              <PieChartComponent ChartProps={pieProps} />
            </SGridPlotCard>
          </div>

          {/*** Right Sidebar Chart Registry ***/}
          <SidebarRight pageId="3col" swapyRef={swapyRef} />
        </div>
        </ChartDatasetProvider>
      </InterfaceContextProvider>
    </main>
  );
}
