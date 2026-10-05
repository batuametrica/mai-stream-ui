import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm];
const components: Components = {
  table: ({ node: _node, ...props }) => (
    <div className="message-table-scroll" tabIndex={0} role="region" aria-label="Yanıt tablosu">
      <table {...props} />
    </div>
  ),
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  ),
};

// Streaming drafts and final answers use the same renderer. Raw HTML stays disabled.
export default memo(function MessageMarkdown({ text }: { text: string }) {
  return (
    <div className="message-markdown">
      <Markdown remarkPlugins={plugins} components={components} skipHtml>{text}</Markdown>
    </div>
  );
});
