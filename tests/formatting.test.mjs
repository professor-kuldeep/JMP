import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFormatting as edit, formattingState } from '../app/lib/formatting.mjs';
for (const [tool, marker] of Object.entries({ bold: '**', italic: '*', underline: '++', strike: '~~', code: '`' })) {
  test(`${tool} toggles repeatedly without adding wrappers`, () => {
    let x = { value: 'Hello world', start: 0, end: 5 };
    for (let i = 0; i < 6; i++) {
      x = edit(x.value, x.start, x.end, tool);
      assert.equal(x.value, i % 2 === 0 ? `${marker}Hello${marker} world` : 'Hello world');
    }
  });
  test(`${tool} removes wrappers when the whole marked text is selected`, () => assert.equal(edit(`${marker}Hello${marker}`, 0, 5 + 2 * marker.length, tool).value, 'Hello'));
}
test('bold and italic remain independent', () => {
  assert.equal(edit('***Hello***', 3, 8, 'bold').value, '*Hello*');
  assert.equal(edit('***Hello***', 3, 8, 'italic').value, '**Hello**');
  assert.equal(edit('**Hello**', 2, 7, 'italic').value, '***Hello***');
});
test('caret inside bold removes bold without replacing text', () => assert.equal(edit('**Hello world**', 6, 6, 'bold').value, 'Hello world'));
test('partial selection inside bold leaves other words bold', () => assert.equal(edit('**one two three**', 6, 9, 'bold').value, '**one** two **three**'));
test('whitespace stays outside added markers', () => assert.equal(edit(' Hello ', 0, 7, 'bold').value, ' **Hello** '));
test('multiline bullet and numbered lists toggle off', () => {
  for (const tool of ['bullet', 'number', 'quote', 'h2', 'h3']) {
    const first = edit('one\ntwo', 0, 7, tool);
    assert.equal(edit(first.value, first.start, first.end, tool).value, 'one\ntwo');
  }
});
test('heading converts and toggles without repeated prefixes', () => {
  assert.equal(edit('## Heading', 3, 10, 'h2').value, '# Heading');
  assert.equal(edit('# Heading', 2, 9, 'h2').value, 'Heading');
});
test('links toggle off and unsafe schemes are rejected', () => {
  const link = edit('Read more', 0, 9, 'link', '/resources');
  assert.equal(link.value, '[Read more](/resources)');
  assert.equal(edit(link.value, link.start, link.end, 'link').value, 'Read more');
  assert.equal(edit('hello', 0, 5, 'link', 'javascript:alert(1)').value, 'hello');
});
test('toolbar state recognises styles', () => {
  assert.equal(formattingState('**Hello**', 2, 7).bold, true);
  assert.equal(formattingState('**Hello**', 2, 7).italic, false);
});
test('clear formatting preserves the words', () => assert.equal(edit('## **Hello** and ++welcome++', 0, 28, 'clear').value, 'Hello and welcome'));

test('old duplicate formatting markers are removed in one action', () => {
  assert.equal(edit('****Hello****',4,9,'bold').value,'Hello');
  assert.equal(edit('++++Hello++++',4,9,'underline').value,'Hello');
  assert.equal(edit('~~~~Hello~~~~',4,9,'strike').value,'Hello');
});
