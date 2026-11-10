async function observeDOM(input, fontAssets, columns) {
  // A fresh about:blank document is in quirks mode. CSS layout comparisons
  // require standards mode, particularly for zero-font inline struts.
  if (document.compatMode !== 'CSS1Compat') {
    document.open();
    document.write('<!doctype html><html><head></head><body></body></html>');
    document.close();
  }
  const dimensions = new Set(['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'flexBasis', 'rowGap', 'columnGap']);
  const sides = ['top', 'right', 'bottom', 'left'];
  const defaults = { display: 'block', boxSizing: 'content-box', direction: 'ltr', unicodeBidi: 'normal', writingMode: 'horizontal-tb', textOrientation: 'mixed',
    flexDirection: 'row', flexWrap: 'nowrap', flexGrow: 0, flexShrink: 1, flexBasis: 'auto', order: 0,
    gridTemplateRows: 'none', gridTemplateColumns: 'none', gridTemplateAreas: 'none',
    gridAutoRows: 'auto', gridAutoColumns: 'auto', gridAutoFlow: 'row',
    rowGap: 'normal', columnGap: 'normal',
    gridRowStart: 'auto', gridRowEnd: 'auto', gridColumnStart: 'auto', gridColumnEnd: 'auto',
    justifyContent: 'normal', justifySelf: 'auto', justifyItems: 'normal', alignItems: 'normal', alignSelf: 'auto', alignContent: 'normal',
    overflowX: 'visible', overflowY: 'visible', scrollbarWidth: 'auto', scrollbarGutter: 'auto',
    position: 'static', float: 'none', clear: 'none', visibility: 'visible',
    lineHeight: 'normal', verticalAlign: 'baseline', baselineSource: 'auto',
    breakBefore: 'auto', breakAfter: 'auto', breakInside: 'auto', orphans: 2, widows: 2,
    textAlign: 'start', textAlignLast: 'auto', textIndent: '0px', textWrap: 'wrap', whiteSpaceCollapse: 'collapse', tabSize: 8, boxDecorationBreak: 'slice' };
  const dimension = value => {
    if (typeof value === 'number') return `${value}px`;
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && typeof value.percent === 'number') {
      return value.length === undefined ? `${value.percent * 100}%` : `calc(${value.length}px + ${value.percent * 100}%)`;
    }
    throw new Error(`Invalid dimension ${JSON.stringify(value)}`);
  };
  const gridTrack = value => {
    if (value && typeof value === 'object') {
      if (Object.hasOwn(value, 'fr')) return `${value.fr}fr`;
      if (Object.hasOwn(value, 'minmax')) return `minmax(${gridTrack(value.minmax[0])}, ${gridTrack(value.minmax[1])})`;
      if (Object.hasOwn(value, 'fitContent')) return `fit-content(${dimension(value.fitContent)})`;
    }
    return dimension(value);
  };
  // Subgrid line-name groups are slots: preserve adjacent and empty groups.
  const subgridNames = values => values.map(value =>
    Object.hasOwn(value, 'repeat')
      ? `repeat(${value.repeat.count}, ${subgridNames(value.repeat.tracks)})`
      : `[${value.names.map(name => CSS.escape(name)).join(' ')}]`).join(' ');
  const gridTracks = values => {
    if (values && typeof values === 'object' && Object.hasOwn(values, 'subgrid')) {
      const names = subgridNames(values.subgrid);
      return names ? `subgrid ${names}` : 'subgrid';
    }
    if (!Array.isArray(values)) return gridTrack(values);
    const parts = [];
    let names = [];
    const flushNames = () => {
      if (names.length) parts.push(`[${names.map(name => CSS.escape(name)).join(' ')}]`);
      names = [];
    };
    for (const value of values) {
      if (value && typeof value === 'object' && Object.hasOwn(value, 'names')) {
        names.push(...value.names);
        continue;
      }
      flushNames();
      if (value && typeof value === 'object' && Object.hasOwn(value, 'repeat')) {
        parts.push(`repeat(${value.repeat.count}, ${gridTracks(value.repeat.tracks)})`);
      } else parts.push(gridTrack(value));
    }
    flushNames();
    return parts.join(' ');
  };
  const gridLine = value => {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value === 'auto' ? value : CSS.escape(value);
    const name = value.name === undefined ? '' : ` ${CSS.escape(value.name)}`;
    return Object.hasOwn(value, 'span') ? `span ${value.span}${name}` : `${value.line}${name}`;
  };
  const gridValue = (name, value) => {
    if (/^grid(?:Template|Auto)(Rows|Columns)$/.test(name)) return gridTracks(value);
    if (name === 'gridTemplateAreas') return value.length ? value.map(row => JSON.stringify(row.join(' '))).join(' ') : 'none';
    if (/^grid(Row|Column)(Start|End)$/.test(name)) return gridLine(value);
    return value;
  };
  const gridProperties = Object.keys(defaults).filter(name => name.startsWith('grid'));
  const textIndentValue = value => {
    const options = value && typeof value === 'object' && Object.hasOwn(value, 'value') ? value : { value };
    return `${dimension(options.value)}${options.hanging ? ' hanging' : ''}${options.eachLine ? ' each-line' : ''}`;
  };
  const cssName = name => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  const set = (element, name, value) => {
    const property = cssName(name);
    if (!CSS.supports(property, String(value))) throw new Error(`Chrome rejects ${property}: ${value}`);
    element.style.setProperty(property, String(value));
  };
  document.documentElement.style.cssText = 'margin:0;padding:0;border:0;width:100%;height:100%;overflow:hidden;';
  document.body.replaceChildren();
  document.body.style.cssText = 'display:flow-root;margin:0;padding:0;border:0;width:100%;height:100%;overflow:hidden;font-size:0;line-height:0;';
  const fontEvidence = [], textEvidence = [], textJustifyEvidence = [], textIndentEvidence = [], marginBreakEvidence = [], gridEvidence = [];
  const zeroFont = { fontSize: 0, ascent: 0, descent: 0, lineGap: 0, xHeight: 0,
    capHeight: 0, subscriptOffset: 0, superscriptOffset: 0 };
  const fontMetrics = key => key === 0 ? zeroFont : input.fonts[key - 1];
  const assets = new Map((fontAssets?.fonts ?? []).map(font => [font.key, font]));
  const fontFamily = key => assets.get(key)?.family ?? 'monospace';
  if (fontAssets) {
    document.fonts.clear();
    const keys = new Set(input.nodes.filter(node => node.style).map(node => node.style.fontKey ?? 0));
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
    for (const key of keys) {
      const metrics = fontMetrics(key), asset = assets.get(key);
      const evidence = { key, family: fontFamily(key), sha256: asset?.sha256 ?? null,
        fontSize: metrics.fontSize, expected: metrics, matched: false };
      fontEvidence.push(evidence);
      const unavailable = fontAssets.unsupported.find(font => font.key === key);
      if (unavailable || key !== 0 && !asset) {
        evidence.reason = unavailable?.reason ?? 'The authored font backend supplied no matching asset.';
        continue;
      }
      if (metrics.fontSize !== 0) {
        try {
          if (!asset.dataUrl) throw new Error('Missing nonzero font data');
          const face = new FontFace(asset.family, `url("${asset.dataUrl}")`, { style: 'normal', weight: '400' });
          await face.load();
          document.fonts.add(face);
          await document.fonts.load(`${metrics.fontSize}px "${asset.family}"`, alphabet);
          evidence.loadStatus = face.status;
          if (face.status !== 'loaded' || !document.fonts.check(`${metrics.fontSize}px "${asset.family}"`, alphabet)) {
            throw new Error('FontFace did not become available');
          }
        } catch (error) {
          evidence.reason = `Authored font could not be loaded in Chrome: ${error.message}`;
          continue;
        }
      } else evidence.loadStatus = 'zero-size-no-asset';
      // Isolated calibration uses only the supplied font profile, never native
      // layout output or the geometry of a fixture under comparison.
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;white-space:pre;direction:ltr;writing-mode:horizontal-tb;font-family:"${fontFamily(key)}";font-size:${metrics.fontSize}px;font-weight:400;font-style:normal;font-synthesis:none;font-kerning:none;font-variant-ligatures:none;letter-spacing:0;word-spacing:0;line-height:normal;padding:0;border:0;margin:0;`;
      const sample = document.createTextNode(alphabet);
      const baseline = document.createElement('span');
      baseline.style.cssText = 'display:inline-block;vertical-align:baseline;width:0;height:0;margin:0;padding:0;border:0;';
      probe.append(sample, baseline);
      document.body.append(probe);
      const range = document.createRange();
      range.selectNodeContents(sample);
      const bounds = range.getBoundingClientRect(), baselineY = baseline.getBoundingClientRect().bottom;
      const advances = [...alphabet].map((character, offset) => {
        range.setStart(sample, offset); range.setEnd(sample, offset + 1);
        return { character, width: range.getBoundingClientRect().width };
      });
      const units = document.createElement('span');
      units.style.cssText = 'position:absolute;width:1ex;height:1cap;padding:0;border:0;margin:0;';
      probe.append(units);
      const unitBounds = units.getBoundingClientRect();
      const scriptShift = value => {
        const marker = baseline.cloneNode();
        marker.style.verticalAlign = value;
        probe.append(marker);
        const shift = marker.getBoundingClientRect().bottom - baseline.getBoundingClientRect().bottom;
        marker.remove();
        return shift;
      };
      const actual = { ascent: baselineY - bounds.top, descent: bounds.bottom - baselineY,
        xHeight: unitBounds.width, capHeight: unitBounds.height,
        subscriptOffset: scriptShift('sub'), superscriptOffset: -scriptShift('super'),
        normalLineHeight: probe.getBoundingClientRect().height, advances };
      probe.remove();
      const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= 1e-6;
      evidence.actual = actual;
      evidence.metricMatches = Object.fromEntries(['ascent', 'descent', 'xHeight', 'capHeight', 'subscriptOffset', 'superscriptOffset']
        .map(name => [name, near(actual[name], metrics[name])]));
      evidence.metricMatches.normalLineHeight = near(actual.normalLineHeight, metrics.ascent + metrics.descent + metrics.lineGap);
      evidence.matched = evidence.metricMatches.ascent && evidence.metricMatches.descent
        && advances.every(advance => near(advance.width, metrics.fontSize / 2));
      if (!evidence.matched) evidence.reason = 'The loaded browser font does not reproduce the supplied ascent/descent and ASCII half-em advances in isolated DOM Range calibration.';
    }
  }
  document.getElementById('silk-scrollbar-policy')?.remove();
  const scrollbarCSS = document.createElement('style');
  scrollbarCSS.id = 'silk-scrollbar-policy';
  // A zero-size pseudo scrollbar retains scrollability and the original overlay
  // corpus geometry. Do not use scrollbar-width:none: that changes the input CSS.
  scrollbarCSS.textContent = input.nodes.map((node, i) => {
    if (Object.hasOwn(node, 'text')) return '';
    const metrics = input.scrollbars?.[node.style.scrollbarWidth ?? 'auto'];
    const horizontal = metrics && !metrics.overlay ? metrics.horizontal : 0;
    const vertical = metrics && !metrics.overlay ? metrics.vertical : 0;
    return `[data-node="${i}"]::-webkit-scrollbar{width:${vertical}px;height:${horizontal}px}`;
  }).join('\n');
  document.head.append(scrollbarCSS);
  window.scrollTo(0, 0);
  // This subtree boundary is the native viewport, not the HTML root scrollport.
  // Positioning establishes the abspos CB without trapping viewport-fixed boxes.
  const viewport = document.createElement('div');
  viewport.style.cssText = `position:relative;display:flow-root;box-sizing:content-box;margin:0;padding:0;border:0;width:${input.viewport.width}px;height:${input.viewport.height}px;overflow:hidden;direction:ltr;writing-mode:horizontal-tb;overflow-anchor:none;`;
  document.body.append(viewport);
  let flow = viewport;
  if (columns) {
    flow = document.createElement('div');
    flow.style.cssText = `position:relative;left:${columns.x}px;top:${columns.y}px;box-sizing:content-box;margin:0;padding:0;border:0;width:${columns.width}px;height:${columns.height}px;writing-mode:${columns.mode};direction:${columns.direction};column-count:1;column-width:auto;column-gap:${columns.gap}px;column-fill:auto;overflow:visible;`;
    viewport.append(flow);
  }
  const elements = [], markers = [], lastMarkers = [], loads = [], resources = [];
  for (let i = 0; i < input.nodes.length; i++) {
    const node = input.nodes[i];
    if (Object.hasOwn(node, 'text')) {
      const text = document.createTextNode(node.text);
      elements[node.parent].append(text);
      elements.push(text);
      continue;
    }
    const replaced = node.natural !== undefined || node.style.replaced;
    const element = document.createElement(replaced ? 'img' : 'div');
    if (replaced) {
      const natural = node.natural ?? {}, attributes = [];
      // Missing dimensions stay missing; zero remains an explicit length.
      // SVG intrinsic sizing: https://www.w3.org/TR/SVG2/coords.html#IntrinsicSizing
      for (const name of ['width', 'height']) {
        if (natural[name] !== undefined) attributes.push(`${name}="${natural[name]}px"`);
      }
      if (natural.aspectRatio > 0) attributes.push(`viewBox="0 0 ${natural.aspectRatio} 1"`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" ${attributes.join(' ')}></svg>`;
      resources.push({ node: i, kind: 'data-svg-image', natural, svg });
      // Register before assigning src, including when the same data URL is cached.
      const loaded = new Promise((resolve, reject) => {
        element.onload = resolve;
        element.onerror = () => reject(new Error(`Resource node ${i} failed to load`));
      });
      element.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      loads.push(loaded.then(async () => {
        await element.decode();
        element.onload = element.onerror = null;
      }));
    }
    element.dataset.node = String(i);
    element.style.overflowAnchor = 'none';
    for (const [name, value] of Object.entries(defaults)) set(element, name, value);
    // Native element styles are computed values. Reset this inherited property
    // per element, but do not reject default fixtures on browsers without it.
    element.style.setProperty('text-justify', 'auto');
    element.style.setProperty('margin-break', 'auto');
    if (fontAssets) {
      // Element styles are already computed in the native protocol: omitted
      // fontKey means zero, not inherited. DOM Text inherits its owning element.
      const key = node.style.fontKey ?? 0, metrics = fontMetrics(key);
      const height = node.style.lineHeight ?? 'normal';
      const lineHeight = height === 'normal' ? metrics.ascent + metrics.descent + metrics.lineGap
        : typeof height === 'number' ? metrics.fontSize * height : height.length;
      set(element, 'fontFamily', `"${fontFamily(key)}"`);
      set(element, 'fontSize', `${metrics.fontSize}px`);
      set(element, 'lineHeight', height === 'normal' ? 'normal' : `${lineHeight}px`);
      set(element, 'fontSynthesis', 'none');
      set(element, 'fontKerning', 'none');
      set(element, 'fontVariantLigatures', 'none');
    }
    // Individual sides override shorthands regardless of JSON property order.
    const edges = new Set(['padding', 'margin', 'border', 'inset']);
    const entries = Object.entries(node.style).sort(([a], [b]) => Number(edges.has(b)) - Number(edges.has(a)));
    for (const [name, value] of entries) {
      if (name.endsWith('Safety') || name === 'replaced' || name === 'aspectRatioAuto' || name === 'fontKey') continue;
      if (gridProperties.includes(name)) {
        // Keep support and computed-value evidence even when Chrome rejects a
        // declaration. The native adapter validates the structured input.
        element.style.setProperty(cssName(name), gridValue(name, value));
        continue;
      }
      if (name === 'textJustify') {
        // Retain the requested spelling, including the mandated legacy alias.
        // Unsupported declarations are reported with computed-style evidence.
        element.style.setProperty('text-justify', value);
        continue;
      }
      if (name === 'marginBreak') {
        element.style.setProperty('margin-break', value);
        continue;
      }
      if (name === 'textIndent') {
        element.style.setProperty('text-indent', textIndentValue(value));
        continue;
      }
      if (name === 'lineHeight') {
        if (fontAssets) continue;
        set(element, name, typeof value === 'object' ? `${value.length}px` : value);
        continue;
      }
      if (name === 'tabSize') {
        set(element, name, typeof value === 'object' ? `${value.length}px` : value);
        continue;
      }
      if (name === 'verticalAlign') {
        set(element, name, dimension(value));
        continue;
      }
      if (name === 'aspectRatio') {
        set(element, name, value === 0 ? 'auto' : `${node.style.aspectRatioAuto ? 'auto ' : ''}${value}`);
        continue;
      }
      if (['padding', 'margin', 'border', 'inset'].includes(name)) {
        for (const side of sides) {
          const v = typeof value === 'object' && !('percent' in value) ? value[side] : value;
          if (v === undefined) continue;
          const key = name === 'inset' ? side : `${name}${side[0].toUpperCase()}${side.slice(1)}${name === 'border' ? 'Width' : ''}`;
          set(element, key, dimension(v));
          if (name === 'border') set(element, `border${side[0].toUpperCase()}${side.slice(1)}Style`, 'solid');
        }
      } else if (/^(margin|padding|border|inset)(Top|Right|Bottom|Left)$/.test(name)) {
        let property = name;
        if (name.startsWith('inset')) property = name.slice(5).toLowerCase();
        if (name.startsWith('border')) { property += 'Width'; set(element, `${name}Style`, 'solid'); }
        set(element, property, dimension(value));
      } else set(element, name, dimensions.has(name) ? dimension(value) : value);
    }
    for (const property of ['justifyContent', 'justifySelf', 'justifyItems', 'alignContent', 'alignItems', 'alignSelf']) {
      const safety = node.style[`${property}Safety`];
      if (safety && safety !== 'default') set(element, property, `${safety} ${node.style[property] ?? defaults[property]}`);
    }
    // compute() enters an independent formatting context. The DOM wrapper is
    // not the document element, so establish that same boundary explicitly.
    if (!replaced && node.parent === null && ['block', 'flow', 'block flow', 'flow block'].includes(node.style.display ?? 'block')) {
      set(element, 'display', 'flow-root');
    }
    if (node.measure && node.measure.hasLineBoxes !== false) {
      const m = node.measure, atomic = document.createElement('span'), marker = document.createElement('span');
      const baseline = m.firstBaseline ?? m.lastBaseline ?? m.height;
      atomic.style.cssText = `display:inline-block;vertical-align:baseline;width:${m.maxWidth}px;height:${m.height}px;line-height:0;font-size:0;padding:0;border:0;margin:0;`;
      // A zero-width inline box sets the line baseline without platform fonts.
      marker.style.cssText = `display:inline-block;vertical-align:baseline;width:0;height:${baseline}px;padding:0;border:0;margin:0;`;
      atomic.append(marker); markers[i] = marker;
      const last = m.lastBaseline ?? baseline;
      if (last === baseline) element.append(atomic);
      else {
        // Two overlapping metric lines preserve the declared fixed intrinsic
        // box while exposing distinct first/last in-flow baselines to CSS.
        // Keep them as direct block children: wrapping both in one atomic
        // inline would export only that inline's last baseline.
        const firstLine = document.createElement('div'), lastLine = document.createElement('div');
        firstLine.style.cssText = `height:${m.height}px;line-height:0;font-size:0;padding:0;border:0;margin:0;`;
        lastLine.style.cssText = firstLine.style.cssText;
        lastLine.style.marginTop = `${-m.height}px`;
        const lastAtomic = atomic.cloneNode(true), lastMarker = lastAtomic.firstElementChild;
        lastMarker.style.height = `${last}px`;
        firstLine.append(atomic); lastLine.append(lastAtomic);
        element.append(firstLine, lastLine); lastMarkers[i] = lastMarker;
      }
    }
    (node.parent === null ? flow : elements[node.parent]).append(element);
    elements.push(element);
  }
  await Promise.all(loads);
  const scrollStates = [], unsupported = [], scrollbarEvidence = [];
  const scrollable = value => ['auto', 'scroll', 'hidden', 'overlay'].includes(value);
  const applyScroll = (element, node, supplied, enabled) => {
    const requested = supplied ?? { x: 0, y: 0 };
    const effective = { x: enabled.x ? requested.x : 0, y: enabled.y ? requested.y : 0 };
    element.scrollLeft = effective.x;
    element.scrollTop = effective.y;
    scrollStates.push({ node, requested, effective, element });
  };
  applyScroll(viewport, null, input.viewportScrollOffset, { x: true, y: true });
  elements.forEach((element, i) => {
    if (element.nodeType === Node.TEXT_NODE) return;
    const node = input.nodes[i], style = node.style;
    // Use pinned computed-overflow rules, not Chrome's newer clip conversion.
    // Differences in resulting geometry remain genuine differential failures.
    const x = style.overflowX ?? 'visible', y = style.overflowY ?? 'visible';
    const generatesBox = element.getClientRects().length !== 0;
    applyScroll(element, i, node.scrollOffset, {
      x: generatesBox && (scrollable(x) || x === 'visible' && scrollable(y)),
      y: generatesBox && (scrollable(y) || y === 'visible' && scrollable(x))
    });
  });
  await new Promise(resolve => requestAnimationFrame(resolve));
  // Inputs are scroll requests. Range clamping is expected; resulting geometry
  // is compared normally, including any disagreement from offset quantization.
  const scrollOffsets = scrollStates.map(({ element, ...state }) => {
    const actual = { x: element.scrollLeft, y: element.scrollTop };
    return { ...state, actual };
  });
  const viewportOrigin = viewport.getBoundingClientRect();
  const origins = [];
  // CSSOM scrollWidth/scrollHeight are integer dimensions, not fractional
  // overflow rectangles or their signed origins. Do not turn them into
  // expected native overflow fields; those have normative spec assertions.
  return { schemaVersion: 3, documentMode: document.compatMode, resources, scrollOffsets, scrollbarEvidence, fontEvidence, textEvidence, textJustifyEvidence, textIndentEvidence, marginBreakEvidence, gridEvidence, unsupported, sources: elements.map((element, i) => {
    const node = input.nodes[i];
    const parent = node.parent === null ? viewportOrigin : origins[node.parent];
    if (element.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getBoundingClientRect(), clientRects = [...range.getClientRects()];
      origins[i] = clientRects.length === 0 ? parent : rect;
      const rects = clientRects.map(value => ({ x: value.x - viewportOrigin.x, y: value.y - viewportOrigin.y, width: value.width, height: value.height }));
      const style = getComputedStyle(element.parentElement);
      const key = input.nodes[node.parent].style.fontKey ?? 0;
      const evidence = fontEvidence.find(font => font.key === key);
      const expectedCollapse = input.nodes[node.parent].style.whiteSpaceCollapse ?? 'collapse';
      const profile = !/[^A-Za-z0-9 \t\r\n\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(node.text)
        && style.writingMode === 'horizontal-tb' && ['ltr', 'rtl'].includes(style.direction)
        && style.whiteSpaceCollapse === expectedCollapse;
      textEvidence.push({ node: i, fontKey: key, family: style.fontFamily, fontSize: style.fontSize,
        lineHeight: style.lineHeight, writingMode: style.writingMode, direction: style.direction,
        whiteSpaceCollapse: style.whiteSpaceCollapse, tabSize: style.tabSize, textWrap: style.textWrap,
        textJustify: style.getPropertyValue('text-justify'), textIndent: style.textIndent,
        profileMatched: profile, fontMatched: evidence?.matched === true });
      if (!profile || !evidence?.matched) unsupported.push({ node: i, feature: 'fixture-text-font',
        reason: !profile ? 'Source text is outside the ASCII letters/digits, Bidi_Control characters, ASCII whitespace, horizontal-tb LTR/RTL font profile, or Chrome did not retain the requested white-space-collapse value.'
          : evidence?.reason ?? 'No matching browser font was measured for this source text.',
        fontKey: key, text: node.text, rects });
      return { kind: 'text', text: node.text, x: clientRects.length ? rect.x - parent.x : 0,
        y: clientRects.length ? rect.y - parent.y : 0, width: rect.width, height: rect.height, rects };
    }
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    if (style.display.includes('grid') || gridProperties.some(name => Object.hasOwn(node.style, name))) {
      for (const name of gridProperties) {
        const property = cssName(name);
        const requested = Object.hasOwn(node.style, name) ? gridValue(name, node.style[name]) : defaults[name];
        const evidence = { node: i, property, requested, specified: element.style.getPropertyValue(property),
          computed: style.getPropertyValue(property), cssSupported: CSS.supports(property, requested) };
        gridEvidence.push(evidence);
        // Track lists expose used pixel sizes through getComputedStyle; those
        // cannot be compared textually with authored fr/minmax/repeat values.
        if (!evidence.cssSupported || !evidence.specified || !evidence.computed) {
          unsupported.push({ node: i, feature: property,
            reason: 'Chrome does not support or did not retain the requested grid declaration.', evidence });
        }
      }
    }
    const requestedJustify = node.style.textJustify ?? 'auto';
    const expectedJustify = requestedJustify === 'distribute' ? 'inter-character' : requestedJustify;
    const justifyEvidence = { node: i, requested: requestedJustify, expected: expectedJustify,
      computed: style.getPropertyValue('text-justify'), cssSupported: CSS.supports('text-justify', requestedJustify) };
    textJustifyEvidence.push(justifyEvidence);
    if (requestedJustify !== 'auto' && (!justifyEvidence.cssSupported || justifyEvidence.computed !== expectedJustify)) {
      unsupported.push({ node: i, feature: 'text-justify',
        reason: 'Chrome does not support or did not retain the requested text-justify method.',
        evidence: justifyEvidence });
    }
    const requestedMarginBreak = node.style.marginBreak ?? 'auto';
    const marginEvidence = { node: i, requested: requestedMarginBreak,
      computed: style.getPropertyValue('margin-break'), cssSupported: CSS.supports('margin-break', requestedMarginBreak) };
    marginBreakEvidence.push(marginEvidence);
    if (requestedMarginBreak !== 'auto' && (!marginEvidence.cssSupported || marginEvidence.computed !== requestedMarginBreak)) {
      unsupported.push({ node: i, feature: 'margin-break',
        reason: 'Chrome does not support or did not retain the requested margin-break policy.',
        evidence: marginEvidence });
    }
    if (Object.hasOwn(node.style, 'textIndent')) {
      const requested = textIndentValue(node.style.textIndent);
      const evidence = { node: i, requested, computed: style.textIndent, cssSupported: CSS.supports('text-indent', requested) };
      textIndentEvidence.push(evidence);
      if (!evidence.cssSupported || !element.style.textIndent
        || ['hanging', 'each-line'].some(keyword => requested.includes(keyword) !== style.textIndent.includes(keyword))) {
        unsupported.push({ node: i, feature: 'text-indent', reason: 'Chrome did not retain the requested indentation.', evidence });
      }
    }
    const clientRects = [...element.getClientRects()];
    origins[i] = clientRects.length === 0 ? parent : rect;
    const rects = clientRects.map(value => ({ x: value.x - viewportOrigin.x, y: value.y - viewportOrigin.y, width: value.width, height: value.height }));
    if (clientRects.length === 0) return { kind: 'element', x: 0, y: 0, width: 0, height: 0, contentWidth: 0, contentHeight: 0, rects };
    const px = name => parseFloat(style[name]) || 0;
    const box = { kind: 'element', x: rect.x - parent.x, y: rect.y - parent.y, width: rect.width, height: rect.height, rects };
    // Non-replaced inline content has fragment areas, not one used content box.
    if (clientRects.length !== 1 || style.display === 'inline' && !(element instanceof HTMLImageElement)) return box;
    box.contentWidth = Math.max(0, rect.width - px('paddingLeft') - px('paddingRight') - px('borderLeftWidth') - px('borderRightWidth'));
    box.contentHeight = Math.max(0, rect.height - px('paddingTop') - px('paddingBottom') - px('borderTopWidth') - px('borderBottomWidth'));
    const width = node.style.scrollbarWidth ?? 'auto';
    const metrics = input.scrollbars?.[width];
    const requestedObservation = input.scrollbars !== undefined || node.style.scrollbarWidth !== undefined || node.style.scrollbarGutter !== undefined;
    if (requestedObservation) {
      const evidence = { node: i, metrics: metrics ?? null, scrollbarWidth: style.scrollbarWidth,
        scrollbarGutter: style.scrollbarGutter, overflowX: style.overflowX, overflowY: style.overflowY,
        writingMode: style.writingMode, replaced: element instanceof HTMLImageElement,
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        allottedWidth: box.contentWidth, allottedHeight: box.contentHeight,
        border: { top: px('borderTopWidth'), right: px('borderRightWidth'), bottom: px('borderBottomWidth'), left: px('borderLeftWidth') },
        padding: { top: px('paddingTop'), right: px('paddingRight'), bottom: px('paddingBottom'), left: px('paddingLeft') },
        clientWidth: element.clientWidth, clientHeight: element.clientHeight,
        clientLeft: element.clientLeft, clientTop: element.clientTop,
        scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
        computedWidth: style.width, computedHeight: style.height };
      if (style.scrollbarGutter.includes('both-edges')) {
        evidence.childOrigins = [...element.children].map(child => {
          const childRect = child.getBoundingClientRect();
          return { x: childRect.x - rect.x, y: childRect.y - rect.y };
        });
      }
      // Extents alone do not establish actual scrollability (notably Chrome
      // stable-gutter feedback). Restore used offsets before measuring quads.
      const savedX = element.scrollLeft, savedY = element.scrollTop;
      element.scrollLeft = 1e9;
      const positiveX = element.scrollLeft;
      element.scrollLeft = -1e9;
      const negativeX = element.scrollLeft;
      element.scrollTop = 1e9;
      const positiveY = element.scrollTop;
      element.scrollTop = -1e9;
      const negativeY = element.scrollTop;
      element.scrollLeft = savedX; element.scrollTop = savedY;
      evidence.scrollRange = { minX: negativeX, maxX: positiveX, minY: negativeY, maxY: positiveY };
      scrollbarEvidence.push(evidence);
    }
    if (markers[i] && (node.measure.firstBaseline !== undefined || node.measure.lastBaseline !== undefined)) {
      box.firstBaseline = markers[i].getBoundingClientRect().bottom - rect.top;
      box.lastBaseline = (lastMarkers[i] ?? markers[i]).getBoundingClientRect().bottom - rect.top;
      box.hasFirstBaseline = true; box.hasLastBaseline = true;
    }
    return box;
  }) };
}
