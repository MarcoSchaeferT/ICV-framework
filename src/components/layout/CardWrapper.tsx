import React, { JSX, useEffect } from 'react';
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
import {HoverCardComponentInfo, HoverCardInteractionInfo} from './InfoCards';

/**
 * Presentation and contextual-help contract for one dashboard card.
 *
 * @example
 * ```tsx
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
 * Creates a complete dashboard-card configuration with empty optional information panels.
 *
 * @param id - Stable DOM and Swapy slot identifier.
 * @param headline - Visible card title.
 * @param description - Supporting description below the title.
 * @param footer - Attribution or footer text.
 * @param bgColor - Tailwind background utility.
 * @returns A card configuration accepted by {@link CardWrapper} and `SGridPlotCard`.
 * @default bgColor "bg-surface-light"
 */
export function CardPropsClass(id: string, headline: string, description: string, footer: string, bgColor: string = "bg-surface-light"): CardPropsClass {
    return {
        id,
        headline,
        description,
        footer,
        bgColor,
        infoCard: { content: undefined, footer: undefined },
        infoCardInteraction: { content: undefined, footer: undefined }
    };
}

/**
 * Props accepted by {@link CardWrapper}.
 *
 * @example
 * ```tsx
 * const props: CardWrapperProps = {
 *   children: <div id="berlin-incidence-chart" />,
 *   cardProps: CardPropsClass(
 *     "berlin-incidence",
 *     "Berlin incidence",
 *     "Seven-day incidence by reporting date",
 *     "Source: RKI",
 *   ),
 * };
 * ```
 */
interface CardWrapperProps {
    /** Visualization or table rendered in the card body. */
    children: React.ReactNode;
    /** Card heading, help, footer, styling, and identity. */
    cardProps: CardPropsClass;
}

/**
 * Renders the standard dashboard card shell and required chart-resizing boundary.
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

    const [isClient, setIsClient] = React.useState(false);
    useEffect(() => {
        setIsClient(true);
    }, []);
    // return the card
    if(isClient){
    return (
        <CardGrid className={`size-full relative flex flex-col ${cardProps.bgColor} rounded-md border border-surface-light cardWrapper overflow-hidden`}>
            {cardProps.headline !== undefined && cardProps.description !== undefined && cardProps.headline !== "" ? (
                <CardHeaderGrid className='text-2xl m-0 pl-2 pt-2 bg-gray-400 text-white rounded-t-md border-b border-gray-200'>
                {cardProps.headline !== undefined ? (
                    <>
                        <div className="flex pb-0 items-center justify-between overflow-hidden">
                            <CardTitle className='h-6.5'>{cardProps.headline}</CardTitle>
                            <span className='mr-2 flex flex-row items-center gap-1'>
                                <HoverCardInteractionInfo MDXContent={cardProps.infoCardInteraction?.content} Footer={cardProps.infoCardInteraction?.footer} />
                                <HoverCardComponentInfo MDXContent={cardProps.infoCard?.content} Footer={cardProps.infoCard?.footer} />
                            </span>
                        </div>
                    </>
                ): null}
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

/** Default export for the standard dashboard-card shell. */
export default CardWrapper;
