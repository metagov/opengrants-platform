import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  filePath: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ filePath, className }) => {
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!filePath) return;

    fetch(filePath)
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch((err) => console.error("Markdown load error:", err));
  }, [filePath]);

  return (
    <div className={className ?? "prose prose-invert max-w-none text-[#EEEEEE]"}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};
