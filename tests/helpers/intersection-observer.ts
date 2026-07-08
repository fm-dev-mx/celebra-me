/**
 * Shared MockIntersectionObserver for Jest tests.
 *
 * Usage:
 * ```ts
 * import { MockIntersectionObserver } from '../helpers/intersection-observer';
 *
 * beforeEach(() => {
 *   MockIntersectionObserver.instances = [];
 *   Reflect.set(window, 'IntersectionObserver', MockIntersectionObserver);
 *   Reflect.set(globalThis, 'IntersectionObserver', MockIntersectionObserver);
 * });
 * ```
 */

export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  private readonly callback: IntersectionObserverCallback;
  readonly observed = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = (element: Element) => {
    this.observed.add(element);
  };

  unobserve = (element: Element) => {
    this.observed.delete(element);
  };

  disconnect = () => {
    this.observed.clear();
  };

  takeRecords = (): IntersectionObserverEntry[] => [];

  trigger(element: Element, intersectionRatio = 0.5) {
    this.callback(
      [
        {
          target: element,
          isIntersecting: true,
          intersectionRatio,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}
