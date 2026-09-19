import type {ReactNode} from 'react';
import {SiteFooter} from './SiteFooter';
import {SiteHeader} from './SiteHeader';

export function InfoPage({eyebrow, title, lead, children}: {eyebrow: string; title: ReactNode; lead: string; children: ReactNode}) {
  return <><SiteHeader/><main className="info-page"><header className="info-page__hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{lead}</p></header>{children}</main><SiteFooter/></>;
}
