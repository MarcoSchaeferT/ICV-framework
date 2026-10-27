import type { MDXComponents } from 'mdx/types'
import React from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import CustomMDXLink from './cutomMDXlink';
import { useLocale } from 'next-intl';
import { Locale } from './i18n/routing';
import alertTypeTranslations from '@messages/markdown/markdownAlertTypes';
import ShowCovGuard from '@/components/ShowCovGuard';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Files, Folder, File } from 'fumadocs-ui/components/files';
import { TypeTable } from 'fumadocs-ui/components/type-table';
 
/**
 * Extracts a GitHub-style alert marker such as `[!NOTE]` from MDX blockquote children.
 *
 * @param children - Rendered blockquote children produced by the MDX compiler.
 * @returns Lowercase alert type, or an empty string for a regular blockquote.
 */
const getAlertType = (children: React.ReactNode): string => {
  // Extract alert type from first paragraph child if present, e.g. "Note:", "Warning:", etc.
  if (!children) return '';
  const arr = React.Children.toArray(children);
  for (const child of arr) {
    if (
      React.isValidElement(child) &&
      child.type === 'p' &&
      child.props &&
      (child.props as { children?: React.ReactNode }).children
    ) {
      // Flatten paragraph children to string for matching
      let paraText = '';
      const childProps = child.props as { children?: React.ReactNode };
      if (typeof childProps.children === 'string') {
      paraText = childProps.children;
      } else if (Array.isArray(childProps.children)) {
      paraText = childProps.children
        .map((c: any) => (typeof c === 'string' ? c : (c.props?.children ?? '')))
        .join('');
      } else if (React.isValidElement(childProps.children)) {
      paraText = (childProps.children as React.ReactElement<any>).props?.children ?? '';
      }
      const matchFull = paraText.match(/^\[!([a-zA-Z]*)\]/);
      if (matchFull === null || matchFull.length < 2) return '';
      const match = matchFull[1];
      if (match) return match.toLowerCase();
    }
    if (typeof child === 'string') {
      const match = child.match(/^([A-Za-z]+):/);
      if (match) return match[1].toLowerCase();
    }
  }
  return '';
};


/** Renders legacy GitHub-style alerts without involving Fumadocs components. */
function LegacyBlockquote({
  children,
  className,
  style,
  ...props
}: React.ComponentPropsWithoutRef<'blockquote'>) {
    const locale = useLocale() as Locale;
    const type = getAlertType(children);
    //console.log('Alert type:', type,props.children);
    const alertClass = type
      ? `markdown-alert markdown-alert-${type}`
      : 'markdown-alert';
    
      let cleanedChildren: React.ReactNode = React.Children.map(children, (child) => {
        if (
          React.isValidElement(child) &&
          child.type === 'p' &&
          child.props &&
          (child.props as { children?: React.ReactNode }).children
        ) {
          const childProps = child.props as { children?: React.ReactNode };
          let paraText = '';
          if (typeof childProps.children === 'string') {
            paraText = childProps.children.replace(`[!${type.toUpperCase()}]`, '');
            return React.cloneElement(child as React.ReactElement<any>, { children: paraText });
          } else if (Array.isArray(childProps.children)) {
            const cleanedArray = childProps.children.map((c: any) => {
              if (typeof c === 'string') {
                return c.replace(`[!${type.toUpperCase()}]`, '');
              }
              // If it's a React element (e.g., a link), keep it as is
              return c;
            });
            return React.cloneElement(child as React.ReactElement<any>, { children: cleanedArray });
          } else if (React.isValidElement(childProps.children)) {
            const innerText = (childProps.children as React.ReactElement<any>).props?.children ?? '';
            paraText = typeof innerText === 'string'
              ? innerText.replace(`[!${type.toUpperCase()}]`, '')
              : innerText;
            return React.cloneElement(child as React.ReactElement<any>, { children: paraText });
          }
        }
        if (typeof child === 'string') {
          return child.replace(`[!${type.toUpperCase()}]`, '');
        }
        return child;
      });
      if (type && typeof children === 'string') {
        cleanedChildren = children.replace(`[!${type.toUpperCase()}]`, '');
      }
    const divProps = props as React.HTMLAttributes<HTMLDivElement>;

    return (
      <div
        className={`${alertClass} ${className ?? ''}`.trim()}
        style={{
          borderLeft: `2px solid var(--github-alert-${type || 'default'}-color)`,
          backgroundColor: `color-mix(in srgb, var(--github-alert-${type || 'default'}-color) 10%, transparent)`,
          ...style,
        }}
        {...divProps}
      >{type && <div className="markdown-alert-title">{alertTypeTranslations[locale][type]}</div>}
        {cleanedChildren}
      </div>
    );
}

/** Legacy MDX element overrides used by the existing localized application pages. */
const baseComponents: MDXComponents = {
  blockquote: LegacyBlockquote,
};
 
/** Interactive Fumadocs documentation components for tabs, steps, accordions, and file trees. */
const interactiveComponents: MDXComponents = {
  Tabs,
  Tab,
  Steps,
  Step,
  Accordion,
  Accordions,
  Files,
  FileTree: Files,
  Folder,
  File,
  TypeTable,
};

/**
 * Supplies application-specific element renderers to compiled MDX content.
 *
 * @returns MDX component map with locale-aware links and translated GitHub-style alerts.
 *
 * @remarks
 * The hook is part of the Next.js MDX integration contract. Keeping custom links here ensures internal documentation
 * navigation remains locale-aware while external links retain normal anchor behavior.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...interactiveComponents,
    ShowCovGuard,
    a: CustomMDXLink,
    ...baseComponents,
    ...components,
  };
}

/**
 * Supplies the component registry expected by the existing application MDX.
 *
 * Fumadocs components intentionally stay out of this global hook so they cannot
 * replace headings, code blocks, tables, or colors on legal and framework pages.
 */
export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    Callout: defaultMdxComponents.Callout,
    Card: defaultMdxComponents.Card,
    Cards: defaultMdxComponents.Cards,
    ...interactiveComponents,
    ShowCovGuard,
    a: CustomMDXLink,
    ...baseComponents,
    ...components,
  };
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
