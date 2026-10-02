// Vite's `?raw` import, which tests use to read the docs they pin data against.
declare module '*?raw' {
  const content: string;
  export default content;
}
