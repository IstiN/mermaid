import { JSDOM, type DOMWindow } from 'jsdom';

export interface HeadlessMermaidConfig {
  startOnLoad?: boolean;
  securityLevel?: 'strict' | 'loose' | 'antiscript' | 'sandbox';
  [key: string]: unknown;
}

export interface HeadlessMermaidRenderResult {
  svg: string;
  bindFunctions?: (element: Element) => void;
}

export interface HeadlessRenderOptions {
  /**
   * Mermaid render id. Defaults to a deterministic value for stable output.
   */
  id?: string;
  /**
   * Mermaid configuration passed to `mermaid.initialize`.
   */
  config?: HeadlessMermaidConfig;
  /**
   * Approximate glyph width used by the SVG text metric shim.
   */
  textWidthFactor?: number;
  /**
   * Approximate line height used by the SVG text metric shim.
   */
  lineHeight?: number;
}

export interface HeadlessRenderResult extends HeadlessMermaidRenderResult {
  id: string;
}

interface MermaidRuntime {
  initialize: (config: HeadlessMermaidConfig) => void;
  render: (id: string, definition: string) => Promise<HeadlessMermaidRenderResult>;
}

type GlobalWithDom = typeof globalThis & {
  window?: Window & typeof globalThis;
  document?: Document;
  navigator?: Navigator;
  Element?: typeof Element;
  HTMLElement?: typeof HTMLElement;
  SVGElement?: typeof SVGElement;
  DOMPurify?: unknown;
};

const DEFAULT_TEXT_WIDTH_FACTOR = 8;
const DEFAULT_LINE_HEIGHT = 16;

function estimateTextWidth(element: Element, textWidthFactor: number): number {
  const text = element.textContent ?? '';
  return Math.max(10, text.length * textWidthFactor);
}

function installSvgTextMetrics(window: DOMWindow, options: Required<Pick<HeadlessRenderOptions, 'textWidthFactor' | 'lineHeight'>>) {
  const svgPrototype = window.SVGElement?.prototype as (SVGElement & {
    getBBox?: () => DOMRect;
    getComputedTextLength?: () => number;
  }) | undefined;

  if (!svgPrototype) {
    return;
  }

  svgPrototype.getBBox = function getBBox() {
    const width = estimateTextWidth(this, options.textWidthFactor);
    return {
      x: 0,
      y: 0,
      width,
      height: options.lineHeight,
      top: 0,
      left: 0,
      right: width,
      bottom: options.lineHeight,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };

  svgPrototype.getComputedTextLength = function getComputedTextLength() {
    return estimateTextWidth(this, options.textWidthFactor);
  };
}

function installDomGlobals(window: DOMWindow): () => void {
  const globalObject = globalThis as GlobalWithDom;
  const previous = {
    window: Object.getOwnPropertyDescriptor(globalObject, 'window'),
    document: Object.getOwnPropertyDescriptor(globalObject, 'document'),
    navigator: Object.getOwnPropertyDescriptor(globalObject, 'navigator'),
    Element: Object.getOwnPropertyDescriptor(globalObject, 'Element'),
    HTMLElement: Object.getOwnPropertyDescriptor(globalObject, 'HTMLElement'),
    SVGElement: Object.getOwnPropertyDescriptor(globalObject, 'SVGElement'),
    DOMPurify: Object.getOwnPropertyDescriptor(globalObject, 'DOMPurify'),
  };

  const setGlobal = (name: keyof GlobalWithDom, value: unknown) => {
    Object.defineProperty(globalObject, name, {
      configurable: true,
      writable: true,
      value,
    });
  };

  const restoreGlobal = (name: keyof GlobalWithDom, descriptor: PropertyDescriptor | undefined) => {
    if (descriptor) {
      Object.defineProperty(globalObject, name, descriptor);
    } else {
      delete globalObject[name];
    }
  };

  setGlobal('window', window);
  setGlobal('document', window.document);
  setGlobal('navigator', window.navigator);
  setGlobal('Element', window.Element);
  setGlobal('HTMLElement', window.HTMLElement);
  setGlobal('SVGElement', window.SVGElement);

  return () => {
    restoreGlobal('window', previous.window);
    restoreGlobal('document', previous.document);
    restoreGlobal('navigator', previous.navigator);
    restoreGlobal('Element', previous.Element);
    restoreGlobal('HTMLElement', previous.HTMLElement);
    restoreGlobal('SVGElement', previous.SVGElement);
    restoreGlobal('DOMPurify', previous.DOMPurify);
  };
}

function createHeadlessWindow(options: HeadlessRenderOptions): DOMWindow {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
  });

  installSvgTextMetrics(dom.window, {
    textWidthFactor: options.textWidthFactor ?? DEFAULT_TEXT_WIDTH_FACTOR,
    lineHeight: options.lineHeight ?? DEFAULT_LINE_HEIGHT,
  });

  return dom.window;
}

/**
 * Render Mermaid text to SVG in a headless DOM environment.
 *
 * This wrapper intentionally lives outside Mermaid's browser entrypoint so downstream
 * runtimes (including GraalJS experiments) can iterate on the headless environment
 * without changing the existing index/browser rendering flow.
 */
export async function renderToSvg(
  definition: string,
  options: HeadlessRenderOptions = {}
): Promise<HeadlessRenderResult> {
  if (!definition || !definition.trim()) {
    throw new Error('Mermaid definition is required');
  }

  const id = options.id ?? 'mermaid-headless';
  const window = createHeadlessWindow(options);
  const restoreGlobals = installDomGlobals(window);

  try {
    const mermaidModule = (await import('mermaid')) as { default: MermaidRuntime };
    const mermaid = mermaidModule.default;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      ...options.config,
    });

    const result = await mermaid.render(id, definition);
    return {
      ...result,
      id,
    };
  } finally {
    restoreGlobals();
    window.close();
  }
}

export default {
  renderToSvg,
};
