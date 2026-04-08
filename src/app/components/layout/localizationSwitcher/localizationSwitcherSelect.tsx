"use client"
// https://github.com/amannn/next-intl/tree/main/examples/example-app-router
import { useParams } from 'next/navigation';
import React, { ReactNode, useState, useTransition } from 'react';
import { clsx } from 'clsx';
import { Locale, usePathname, useRouter } from '@/i18n/routing';
import {Globe} from 'lucide-react';


interface Props {
    children: ReactNode;
    defaultValue: string;
    label: string;
    style: 'chip' | 'dropdown';
}

export default function LocalizationSwitcherSelect({ children, defaultValue, label, style }: Props) {
   const router = useRouter();
   const [isPending, startTransition] = useTransition();
   const pathname = usePathname();
   const params = useParams();

    const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLanguage = event.target.value as Locale;
        startTransition(() => {
            router.replace(
            // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        {pathname, params},
        {locale: newLanguage}
        )
        });
    };

    return (
        <>
        {/* a drowpdown menu for langauge switching*/}
        
            <label className={clsx(
                "relative text-gray-400",
                { "transition-opacity [&:disabled] opacity-30": isPending }
            )}>
                <p className='sr-only'>{label}</p>
                { (
                    <>
                    <select
                        className={`bg-transparent pl-2 pr-6 ${style === 'chip' ? 'hidden' : ''}`}
                        id='languageSelect'
                        defaultValue={defaultValue}
                        disabled={isPending}
                        onChange={handleLanguageChange}
                    >
                        {children}
                    </select>
                </>
                    )}
                <span className='pointer-events-none absolute right-2 top-[8px]'></span>
            </label>
        
        {/* a chip element for langauge switching*/}
        {style === 'chip' && (
            <div className="ml-2">
                <span 
                    className="inline-flex h-7 items-center px-3 py-0.5 rounded-full text-sm font-medium bg-slate-500 cursor-pointer text-white transition-shadow duration-200 hover:bg-slate-600 hover:shadow-lg hover:text-amber-500" 
                    onClick={() => {
                        const event = new Event('change', { bubbles: true });
                        const selectElement = document.querySelector('#languageSelect');
                        if (selectElement) {
                            (selectElement as HTMLSelectElement).value = defaultValue === 'en' ? 'de' : 'en';
                            selectElement.dispatchEvent(event);
                        }
                    }}
                >
                    {/*<Globe className='h-4 w-4 mr-1' />*/}{defaultValue === 'en' ? 'DE' : 'EN'}
                </span>
            </div>
         )}
        </>
    );
}

