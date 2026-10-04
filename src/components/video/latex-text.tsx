import katex from "katex";
import type {CSSProperties, ReactNode} from "react";

type Props = {
  text: string;
  className?: string;
  style?: CSSProperties;
};

const renderPart = (value: string, key: string, displayMode: boolean): ReactNode => {
  try {
    const html = katex.renderToString(value, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      trust: false,
      output: "html",
    });
    return <span key={key} className={displayMode ? "math-block" : "math-inline"} dangerouslySetInnerHTML={{__html: html}} />;
  } catch {
    return <span key={key}>{value}</span>;
  }
};

export function LatexText({text, className, style}: Props) {
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).filter(Boolean);
  return (
    <span className={className} style={{whiteSpace: "pre-wrap", ...style}}>
      {parts.map((part, index) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          return renderPart(part.slice(2, -2), `block-${index}`, true);
        }
        if (part.startsWith("$") && part.endsWith("$")) {
          return renderPart(part.slice(1, -1), `inline-${index}`, false);
        }
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </span>
  );
}
