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
 * 2-2 Columns Dashboard Grid Layout Template Page.
 *
 * @returns Non-scrolling 2x2 grid layout with interactive Swapy cards and a right sidebar chart registry.
 *
 * @remarks
 * Renders a balanced 2x2 grid layout (four quarter slots, `colSpan: 6` each, `rowSpan: 6` each).
 * Sum of row spans equals 12 across 2 rows.
 * A collapsible right sidebar provides a registry of chart preview cards that can be dragged into
 * the main grid via Swapy.
 *
 * @example
 * ```tsx
 * // Route: /[locale]/home/layoutTemplates/2_2_Columns
 * export default function Page22Columns() { ... }
 * ```
 */
export default function Page22Columns() {
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
  const lineProps1 = LinechartProps("22-linechart1");
  lineProps1.dataMode = "generic";

  const barProps = BarchartProps("22-barchart");
  barProps.dataMode = "generic";

  const pieProps = PieChartProps("22-piechart");
  pieProps.dataMode = "generic";

  const lineProps2 = LinechartProps("22-linechart2");
  lineProps2.dataMode = "generic";

  // Cards setup
  const cardTopLeftProps = CardPropsClass("Card-22-TL", "Line Chart 1", "", "");
  const cardTopRightProps = CardPropsClass("Card-22-TR", "Bar Chart", "", "");
  const cardBotLeftProps = CardPropsClass("Card-22-BL", "Pie Chart", "", "");
  const cardBotRightProps = CardPropsClass("Card-22-BR", "Line Chart 2", "", "");

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
            {/*** Top Left Card (6 cols, 6 rows span) ***/}
            <SGridPlotCard rowColSpan={[6, 6]} cardProps={cardTopLeftProps}>
              <LinechartComponent chartProps={lineProps1} />
            </SGridPlotCard>

            {/*** Top Right Card (6 cols, 6 rows span) ***/}
            <SGridPlotCard rowColSpan={[6, 6]} cardProps={cardTopRightProps}>
              <BarchartComponent chartProps={barProps} />
            </SGridPlotCard>

            {/*** Bottom Left Card (6 cols, 6 rows span) ***/}
            <SGridPlotCard rowColSpan={[6, 6]} cardProps={cardBotLeftProps}>
              <PieChartComponent ChartProps={pieProps} />
            </SGridPlotCard>

            {/*** Bottom Right Card (6 cols, 6 rows span) ***/}
            <SGridPlotCard rowColSpan={[6, 6]} cardProps={cardBotRightProps}>
              <LinechartComponent chartProps={lineProps2} />
            </SGridPlotCard>
          </div>

          {/*** Right Sidebar Chart Registry ***/}
          <SidebarRight pageId="22" swapyRef={swapyRef} />
        </div>
        </ChartDatasetProvider>
      </InterfaceContextProvider>
    </main>
  );
}
