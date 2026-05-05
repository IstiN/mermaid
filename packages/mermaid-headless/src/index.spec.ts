import { describe, expect, it } from 'vitest';
import { renderToSvg } from './index.js';

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
});
