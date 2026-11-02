// Build-time stand-in for `linkify-it` (aliased in vite.config.ts, #350). markdown-it constructs a
// LinkifyIt in its constructor but only calls it when `linkify: true`; @a2ui/react builds its renderer
// with `new MarkdownIt()` (default preset, linkify off), so the real library is dead weight (~2.8 kB
// gzip). If a future @a2ui/react turns linkify on, markdown-it calls a method this class lacks and the
// Text render throws — loud in the e2e sweep, never a silent mis-render.
export default class LinkifyIt {
  readonly stub = true;
}
