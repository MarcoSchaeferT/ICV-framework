
import React, { use, useEffect, useMemo } from 'react';


// modified version of: https://www.npmjs.com/package/@react-hook/resize-observer
import useResizeObserver from "@react-hook/resize-observer";
import { useDebounceCallback } from "@react-hook/debounce";

interface Size {
    width: number;
    height: number;
}
// useSizeWatch
const useSizeWatch = (element: HTMLElement | null): Size | undefined => {
    const [size, setSize] = React.useState<Size>();

    React.useLayoutEffect(() => {
        if (element) {
            setSize(element.getBoundingClientRect());
        }
    }, [element]);

    useResizeObserver(element, (entry) => setSize(entry.contentRect));

    return size;
};


// useSizeWatchDebounced
export const useSizeWatchDebounced = (element: HTMLElement | null): Size | undefined => {
    const [size, setSize] = React.useState<Size>();

    const onResize = useDebounceCallback(setSize, 1000);

    useEffect(() => {
        if (element) {
            setSize(element.getBoundingClientRect());
        }
    }, [element]);

    useResizeObserver(element, (entry) => onResize(entry.contentRect));

    return size;
};


const SizeHook = ({element, sizeRef, setSize}: {element: HTMLElement | null, sizeRef: any, setSize: any})  => {

    sizeRef.current = useSizeWatch(element);

    useEffect(() => {
        sizeRef.current = sizeRef.current
        setSize(sizeRef.current);
    });

    return(<></>);

};

export default SizeHook;