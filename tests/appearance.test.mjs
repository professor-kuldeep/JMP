import test from 'node:test';
import assert from 'node:assert/strict';
import { appearanceVariables, contrastRatio, DEFAULT_APPEARANCE } from '../app/lib/appearance.mjs';

function assertReadable(settings) {
  const vars = appearanceVariables(settings);
  const backgrounds = { page: '--page-background', surface: '--surface-color', hero: '--hero-background', soft: '--soft' };
  for (const [name, background] of Object.entries(backgrounds)) {
    for (const role of ['heading', 'text', 'link', 'muted']) {
      assert.ok(contrastRatio(vars[`--${name}-${role}`], vars[background]) >= 4.5, `${name} ${role} must be readable`);
    }
  }
  for (const [text, backgrounds] of [
    ['--on-primary', ['--primary', '--primary-hover']],
    ['--on-accent', ['--accent', '--accent-hover']],
    ['--footer-text', ['--footer-background']],
    ['--footer-heading', ['--footer-background']],
    ['--footer-muted', ['--footer-background']],
    ['--footer-accent', ['--footer-background']]
  ]) for (const background of backgrounds) assert.ok(contrastRatio(vars[text], vars[background]) >= 4.5, `${text} on ${background} must be readable`);
  return vars;
}

test('default branding stays unchanged and readable', () => {
  const vars = assertReadable({});
  assert.equal(vars['--heading-color'], DEFAULT_APPEARANCE.headingColor);
  assert.equal(vars['--primary'], '#123c69');
  assert.equal(vars['--surface-color'], '#ffffff');
});

test('pale headings in the supplied screenshot palette remain legible on every panel', () => {
  const settings = { headingColor: '#dee5ed', backgroundColor: '#d3cfcf', surfaceColor: '#ababab' };
  const original = structuredClone(settings);
  const vars = assertReadable(settings);
  assert.notEqual(vars['--hero-heading'], settings.headingColor);
  assert.notEqual(vars['--surface-heading'], settings.headingColor);
  assert.deepEqual(settings, original, 'rendering must not overwrite saved CMS settings');
});

test('dark surfaces, light branding and a light footer each use their own readable text', () => {
  const vars = assertReadable({ backgroundColor: '#102b43', surfaceColor: '#142638', primaryColor: '#f2b84b', accentColor: '#123c69', headingColor: '#ffffff', textColor: '#f7f6f2', linkColor: '#f2b84b', footerBackgroundColor: '#f7f6f2' });
  assert.equal(vars['--surface-heading'], '#ffffff');
  assert.notEqual(vars['--soft-heading'], '#ffffff');
  assert.notEqual(vars['--footer-text'], '#bac9d5');
});

test('invalid legacy theme values fall back instead of breaking CSS variables', () => {
  const vars = assertReadable({ primaryColor: 'transparent', headingColor: 'var(--missing)', backgroundColor: '', surfaceColor: '#abc', accentColor: null });
  assert.equal(vars['--primary'], '#123c69');
  assert.equal(vars['--surface-color'], '#ffffff');
});
