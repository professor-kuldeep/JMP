// Keep published pages and the editor preview on the same, readable palette.
export const DEFAULT_APPEARANCE = Object.freeze({
  primaryColor: '#123c69', accentColor: '#f2b84b',
  headingColor: '#123c69', textColor: '#25313d',
  backgroundColor: '#ffffff', surfaceColor: '#ffffff',
  linkColor: '#123c69', footerBackgroundColor: '#0b2239'
});

function hex(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}
function channels(color) {
  return [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
}
function luminance(color) {
  const [r, g, b] = channels(color).map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
}
export function contrastRatio(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
function readable(color, background, minimum = 4.5) {
  const candidates = [color, '#123c69', '#25313d', '#ffffff', '#000000'];
  return candidates.find(candidate => contrastRatio(candidate, background) >= minimum)
    || candidates.sort((a, b) => contrastRatio(b, background) - contrastRatio(a, background))[0];
}
function mix(first, second, weight) {
  const other = channels(second);
  return '#' + channels(first).map((value, index) => Math.round(value * weight + other[index] * (1 - weight)).toString(16).padStart(2, '0')).join('');
}

export function appearanceVariables(settings = {}) {
  const palette = Object.fromEntries(Object.entries(DEFAULT_APPEARANCE).map(([key, fallback]) => [key, hex(settings[key], fallback)]));
  // Headings and links historically inherit the brand when no override is set.
  if (!settings.headingColor) palette.headingColor = palette.primaryColor;
  if (!settings.linkColor) palette.linkColor = palette.primaryColor;
  const variables = {
    '--primary': palette.primaryColor, '--accent': palette.accentColor,
    '--page-background': palette.backgroundColor, '--surface-color': palette.surfaceColor,
    '--footer-background': palette.footerBackgroundColor,
    '--soft': '#f7f6f2',
    '--hero-background': mix(palette.backgroundColor, '#f1efe8', .4),
    '--border': mix(palette.surfaceColor, readable(palette.textColor, palette.surfaceColor), .85)
  };
  const backgrounds = {
    page: palette.backgroundColor, surface: palette.surfaceColor,
    hero: variables['--hero-background'], soft: variables['--soft']
  };
  for (const [name, background] of Object.entries(backgrounds)) {
    variables[`--${name}-heading`] = readable(palette.headingColor, background);
    variables[`--${name}-text`] = readable(palette.textColor, background);
    variables[`--${name}-link`] = readable(palette.linkColor, background);
    variables[`--${name}-muted`] = readable('#5e6c78', background);
  }
  Object.assign(variables, {
    '--heading-color': variables['--page-heading'], '--text-color': variables['--page-text'],
    '--link-color': variables['--page-link'], '--muted': variables['--page-muted'],
    '--ink': variables['--surface-text'],
    '--on-primary': readable('#ffffff', palette.primaryColor),
    '--on-accent': readable('#162e43', palette.accentColor),
    '--footer-text': readable('#bac9d5', palette.footerBackgroundColor),
    '--footer-heading': readable('#ffffff', palette.footerBackgroundColor),
    '--footer-muted': readable('#a7bacb', palette.footerBackgroundColor),
    '--footer-accent': readable('#d4b67b', palette.footerBackgroundColor)
  });
  variables['--primary-hover'] = mix(palette.primaryColor, variables['--on-primary'] === '#ffffff' ? '#000000' : '#ffffff', .86);
  variables['--accent-hover'] = mix(palette.accentColor, variables['--on-accent'] === '#ffffff' ? '#000000' : '#ffffff', .8);
  return variables;
}
