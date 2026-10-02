// The test renderer ships without declarations. Keep the small API used by
// these tests typed in the repository, including in a clean EAS installation.
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestRenderer {
    unmount(): void;
    update(element: ReactElement): void;
    toJSON(): unknown;
  }

  export interface TestRendererOptions {
    unstable_isConcurrent?: boolean;
    createNodeMock?: (element: ReactElement) => unknown;
  }

  export function create(element: ReactElement, options?: TestRendererOptions): ReactTestRenderer;
  export const act: typeof import('react').act;

  const TestRenderer: { create: typeof create };
  export default TestRenderer;
}