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
import {HoverCardComponentInfo, HoverCardInteractionInfo} from './infoCards';

export class CardPropsClass {
    id: string;
    headline: string;
    description: string;
    footer: string;
    bgColor: string;
    infoCard?:{
        content?: React.FC;
        footer?: React.FC;
    }
    infoCardInteraction?: {
        content?: React.FC;
        footer?: React.FC;
    }


    constructor(id: string, headline: string, description: string, footer: string, bgColor: string = "bg-surface-light") {
        this.id = id;
        this.headline = headline;
        this.description = description;
        this.footer = footer;
        this.bgColor = bgColor;
        this.infoCard = {
            content: undefined,
            footer: undefined
        };
        this.infoCardInteraction = {
            content: undefined,
            footer: undefined
        };
    }
}

interface CardWrapperProps {
    children: React.ReactNode;
    cardProps: CardPropsClass;
}

const CardWrapper = ({ children, cardProps }: CardWrapperProps) => {
    // fallback to empty cardProps
    if (cardProps === undefined) cardProps = new CardPropsClass('', '', '', '');

    const [isClient, setIsClient] = React.useState(false);
    useEffect(() => {
        setIsClient(true);
    }, []);
    // return the card
    if(isClient){
    return (
        <CardGrid className={`size-full relative flex flex-col ${cardProps.bgColor} rounded-md border border-surface-light  cardWrapper`}>
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

            <CardContentGrid className='gridPlotCardContent flex-1 min-h-0 size-full'>
                {children}
            </CardContentGrid>
            {cardProps.footer !== undefined && cardProps.footer !== "" ? (
                <CardFooter className='text-sm ml-1 text-gray-500'> <p>{cardProps.footer}</p> </CardFooter>
            ): null} 
        </CardGrid>
    );
}else{
   return(<> <LoadingSpinner /></>);

}
};
function LoadingSpinner() {
    return (
        <>
      <div className="flex ">
        <div className="w-16 h-16 border-4 border-t-4  border-gray-200 rounded-full border-t-blue-500 animate-spin"></div>
      </div>
      </>
    );
  }

export default CardWrapper;