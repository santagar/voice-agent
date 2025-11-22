import React from "react";
import ReactMarkdown from "react-markdown";

type MarkdownMessageProps = {
  text: string;
};

export function MarkdownMessage({ text }: MarkdownMessageProps) {
  if (!text) return null;

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

