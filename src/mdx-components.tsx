import type { MDXComponents } from 'mdx/types'
import React from 'react';
import customMDXlink from './cutomMDXlink';
import { useLocale } from 'next-intl';
import { Locale } from './i18n/routing';
import alertTypeTranslations from '../messages/markdown/markdownAlertTypes';
 
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


const baseComponents: MDXComponents = {
  //
  // @ts-ignore: MDXComponents allows lowercase 'blockquote' for custom mapping
  blockquote: (props) => {
    const GetLocale = () => {
      return useLocale() as Locale;
    }
    const locale = GetLocale();
    const type = getAlertType(props.children);
    //console.log('Alert type:', type,props.children);
    const alertClass = type
      ? `markdown-alert markdown-alert-${type}`
      : 'markdown-alert';
    
      let cleanedChildren = React.Children.map(props.children, (child) => {
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
      if (type && typeof props.children === 'string') {
        cleanedChildren = props.children.replace(`[!${type.toUpperCase()}]`, '');
          console.log('Alert class:', `[!${type.toUpperCase()}]`, cleanedChildren);
      }
    return (
      <div
        className={alertClass}
        style={{
          borderLeft: `2px solid var(--github-alert-${type || 'default'}-color)`,
          backgroundColor: `color-mix(in srgb, var(--github-alert-${type || 'default'}-color) 10%, transparent)`,
         // padding: '0.75em 1em',
         // margin: '1em 0',
        }}
        {...props}
      ><div className={`markdown-alert-title`}>{alertTypeTranslations[locale][type.toLowerCase()]}</div>
        {cleanedChildren}
      </div>
    );
  },

};
 
export function useMDXComponents(): MDXComponents {
  const components = {
    a: customMDXlink,
    ...baseComponents,
  };
  return components;
}