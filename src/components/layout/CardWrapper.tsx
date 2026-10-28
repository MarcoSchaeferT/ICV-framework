import React, { JSX } from 'react';
import {
    CardGrid,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    CardHeaderGrid,
    CardContentGrid,
  } from "@/components/ui/card"
import { CardInfoPopover } from './InfoCards';
import { CardHeaderActionTarget } from './CardHeaderAction';

/**
 * Presentation and contextual-help contract for one Vis. Interface card.
 *
 * @example
 * ```tsx
 * import type { CardPropsClass } from "@/framework";
 *
 * const habitatCard: CardPropsClass = {
 *   id: "albopictus-habitat-map",
 *   headline: "Aedes albopictus habitat suitability",
 *   description: "Monthly model mean for July 2024",
 *   footer: "Source: ICV habitat model",
 *   bgColor: "bg-surface-light",
 * };
 * ```
 */
export interface CardPropsClass {
    /** Stable DOM and Swapy slot identifier. */
    id: string;
    /** Visible card heading. */
    headline: string;
    /** Short description displayed below the heading. */
    description: string;
    /** Attribution or supporting text displayed below the content. */
    footer: string;
    /** Tailwind background utility applied to the card shell. */
    bgColor: string;
    /** Optional MDX-backed explanation of the visualization. */
    infoCard?:{
        /** Main informational content component. */
        content?: React.FC<any>;
        /** Optional informational footer component. */
        footer?: React.FC<any>;
    };
    /** Optional MDX-backed explanation of available interactions. */
    infoCardInteraction?: {
        /** Main interaction-help component. */
        content?: React.FC<any>;
        /** Optional interaction-help footer component. */
        footer?: React.FC<any>;
    };
}

/**
 * Creates a Vis. Interface card configuration without optional information panels.
 *
 * @param id - Stable DOM and Swapy slot identifier.
 * @param headline - Visible card title.
 * @param description - Supporting description below the title.
 * @param footer - Attribution or footer text.
 * @param bgColor - Tailwind background utility.
 * @returns A card configuration accepted by {@link CardWrapper} and `SGridPlotCard`.
 */
export function CardPropsClass(id: string, headline: string, description: string, footer: string, bgColor: string = "bg-surface-light"): CardPropsClass {
    return {
        id,
        headline,
        description,
        footer,
        bgColor,
    };
}

/**
 * Props accepted by {@link CardWrapper}.
 *
 * @example
 * ```tsx
 * import { CardPropsClass, type CardWrapperProps } from "@/framework";
 *
 * const props: CardWrapperProps = {
 *   children: <div id="serotype-distribution-chart" />,
 *   cardProps: CardPropsClass(
 *     "serotype-distribution",
 *     "Serotype distribution",
 *     "Sample counts across regions",
 *     "Source: Surveillance",
 *   ),
 * };
 * ```
 */
export interface CardWrapperProps {
    /** Visualization or table rendered in the card body. */
    children: React.ReactNode;
    /** Card heading, help, footer, styling, and identity. */
    cardProps: CardPropsClass;
}

/**
 * Renders the standard Vis. Interface card shell and required chart-resizing boundary.
 *
 * @param props - Card content and presentation configuration.
 * @returns A hydrated card, or a loading indicator during server/client handoff.
 *
 * @remarks
 * The `.gridPlotCardContent` class is an architectural contract consumed by `useChartResizer`. Removing or moving it
 * prevents maps and charts from detecting Swapy grid-card size changes.
 */
const CardWrapper = ({ children, cardProps }: CardWrapperProps) => {
    // fallback to empty cardProps
    if (cardProps === undefined) cardProps = CardPropsClass('', '', '', '');
    const [headerActionTarget, setHeaderActionTarget] = React.useState<HTMLDivElement | null>(null);

    const isClient = React.useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );
    const hasHeader = cardProps.headline !== undefined && cardProps.description !== undefined && cardProps.headline !== "";
    // return the card
    if(isClient){
    return (
        <CardHeaderActionTarget.Provider value={hasHeader ? headerActionTarget : null}>
        <CardGrid className={`size-full relative flex flex-col ${cardProps.bgColor} rounded-md border border-surface-light cardWrapper overflow-hidden`}>
            {hasHeader ? (
                <CardHeaderGrid className='text-2xl m-0 pl-2 pt-2 bg-gray-400 text-white rounded-t-md border-b border-gray-200'>
                    <div className="flex items-center justify-between overflow-hidden pb-0">
                        <CardTitle className='h-6.5 min-w-0 truncate'>{cardProps.headline}</CardTitle>
                        <div className="mr-2 flex shrink-0 items-center gap-1">
                            <CardInfoPopover
                                title={cardProps.headline}
                                info={cardProps.infoCard?.content}
                                interaction={cardProps.infoCardInteraction?.content}
                                infoFooter={cardProps.infoCard?.footer}
                                interactionFooter={cardProps.infoCardInteraction?.footer}
                            />
                            <div ref={setHeaderActionTarget} className="flex items-center gap-1" />
                        </div>
                    </div>
                    {cardProps.description !== undefined ? (
                    <CardDescription className='text-sm text-gray-200'>{cardProps.description}</CardDescription> 
                ): null}
                </CardHeaderGrid>
            ): null}

            <CardContentGrid className='gridPlotCardContent flex-1 min-h-0 size-full overflow-visible'>
                {children}
            </CardContentGrid>
            {cardProps.footer !== undefined && cardProps.footer !== "" ? (
                <CardFooter className='text-sm ml-1 text-gray-500'> <p>{cardProps.footer}</p> </CardFooter>
            ): null} 
        </CardGrid>
        </CardHeaderActionTarget.Provider>
    );
    } else {
        return <LoadingSpinner />;
    }
};

/** Returns the lightweight hydration fallback used before the card mounts on the client. */
function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center size-full">
            <div className="w-12 h-12 border-4 border-gray-300/40 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );
}

/** Default export for the standard Vis. Interface card shell. */
export default CardWrapper;
