import { ArrowUpRight, BarChart3, InfoIcon, MousePointerClick, X } from 'lucide-react';
import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link } from '@/i18n/routing';
import MdxLayout, { MdxLayoutTooltip } from '@/mdx-layout';
import { MDXContentProvider } from '@messages/markdown/MDXContentProvider';

/** Shows the available card explanation and interaction help in one click-opened panel. */
export function CardInfoPopover({
  title,
  info: Info,
  interaction: Interaction,
  infoFooter: InfoFooter,
  interactionFooter: InteractionFooter,
}: {
  title: string;
  info?: React.FC;
  interaction?: React.FC;
  infoFooter?: React.FC;
  interactionFooter?: React.FC;
}) {
  const t = useTranslations('component_infoCard');
  const titleId = useId();

  if (!Info && !Interaction) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('openCardInfo', { title })}
          className="h-8 w-8 shrink-0 text-white hover:text-slate-900 focus-visible:ring-white"
        >
          <InfoIcon className="h-5 w-5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-labelledby={titleId}
        className="legacy-mdx-info-card flex max-h-[min(80vh,42rem)] w-[min(28rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-0 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.5)] dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-200/80 bg-linear-to-br from-slate-50 to-blue-50/80 px-5 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/70">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm dark:bg-blue-500">
            <InfoIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 id={titleId} className="min-w-0 flex-1 break-words pt-1 text-base font-semibold leading-snug text-slate-900 dark:text-slate-50">
            {t('panelTitle', { title })}
          </h2>
          <PopoverClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('closeCardInfo')}
              className="h-8 w-8 shrink-0 text-slate-500 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PopoverClose>
        </div>
        <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-4">
          {Info && (
            <section className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                {t('headingComponentInfo')}
              </h3>
              <MdxLayout><Info /></MdxLayout>
              {InfoFooter && <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"><InfoFooter /></div>}
            </section>
          )}
          {Interaction && (
            <section className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <MousePointerClick className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                {t('headingInteractions')}
              </h3>
              <MdxLayout><Interaction /></MdxLayout>
              {InteractionFooter && <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"><InteractionFooter /></div>}
            </section>
          )}
        </div>
        <div className="shrink-0 border-t border-slate-200/80 bg-slate-50/80 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/70">
          <Link href="/docs" className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-blue-700 underline-offset-4 transition-colors hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:text-blue-200">
            {t('openFullDocs')}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Renders compact localized MDX help suitable for controls and visualization overlays. */
export const HoverCardTooltip: React.FC<{ MDXContent?: React.FC; color?: string }> = ({
  MDXContent = '',
  color = '#b1b1b1',
}) => {
  const locale = useLocale();
  const MDXContext = MDXContentProvider[locale];
  if (!MDXContent) MDXContent = MDXContext.DummyContent;

  return (
    <HoverCard openDelay={5} closeDelay={5}>
      <HoverCardTrigger asChild>
        <InfoIcon
          className="h-5 w-5 cursor-pointer transition-colors duration-200 hover:text-blue-500 hover:scale-110"
          style={{ color }}
        />
      </HoverCardTrigger>
      <HoverCardContent sideOffset={0} className="max-w-[30vw] min-w-[400px] max-h-[80vh] overflow-y-auto bg-transparent z-1000 border-0 ">
        <MdxLayoutTooltip><MDXContent /></MdxLayoutTooltip>
      </HoverCardContent>
    </HoverCard>
  );
};
