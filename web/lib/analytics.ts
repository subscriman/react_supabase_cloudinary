import { ANALYTICS_EVENTS, ANALYTICS_EVENT_REQUIREMENTS, type AnalyticsEventName } from './analytics-events';

export type AnalyticsPrimitive = string | number | boolean | null;
export type AnalyticsPayload = Record<string, AnalyticsPrimitive | undefined>;
export { ANALYTICS_EVENTS };
export const ANALYTICS_EVENT_CATALOG = ANALYTICS_EVENT_REQUIREMENTS;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    plausible?: (eventName: string, options?: { props?: Record<string, AnalyticsPrimitive> }) => void;
  }
}

function compactPayload(payload?: AnalyticsPayload): Record<string, AnalyticsPrimitive> {
  if (!payload) return {};
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined) as Array<
    [string, AnalyticsPrimitive]
  >;
  return Object.fromEntries(entries);
}

export function trackEvent(eventName: AnalyticsEventName, payload?: AnalyticsPayload) {
  if (typeof window === 'undefined') return;

  const compacted = compactPayload(payload);
  window.plausible?.(eventName, { props: compacted });
  window.gtag?.('event', eventName, compacted);

  if (process.env.NODE_ENV !== 'production') {
    console.info('[analytics]', eventName, compacted);
  }
}
