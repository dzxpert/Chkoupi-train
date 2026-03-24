// Single entrypoint that re-exports everything app.js needs.
// esbuild bundles this → one file, ONE @codemirror/state instance.
export { EditorView, basicSetup } from 'codemirror';
export { EditorState } from '@codemirror/state';
export { StreamLanguage } from '@codemirror/language';
export { oneDark } from '@codemirror/theme-one-dark';
