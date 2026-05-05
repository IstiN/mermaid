import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderToSvg, renderToSvgWithEnvironment } from './index.js';

describe('renderToSvg', () => {
  it('renders a flowchart definition to SVG', async () => {
    const result = await renderToSvg('graph TD\nA[Start] --> B[Done]', {
      id: 'headless-test',
    });

    expect(result.id).toBe('headless-test');
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('id="headless-test"');
    expect(result.svg).toContain('flowchart');
  });

  it('renders with a caller-provided DOM environment', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      pretendToBeVisual: true,
    });

    const result = await renderToSvgWithEnvironment(
      'sequenceDiagram\nparticipant A\nparticipant B\nA->>B: Hello',
      {
        window: dom.window,
        cleanup() {
          dom.window.close();
        },
      },
      {
        id: 'provided-env-test',
      }
    );

    expect(result.id).toBe('provided-env-test');
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('sequence');
  });
});
