/**
 * Text with `*inline italic*` markup applied (SPEC §16.3).
 *
 * The italic face here is CharterBT-Italic, not Charis SIL — §16.5 keeps the
 * two apart: Charter for inline emphasis and locations, Charis for company
 * names, project subtitles, and degrees.
 */
import { parseInlineMarkup } from "@/lib/render/markup";

export function InlineText({ text }: { text: string }) {
  const segments = parseInlineMarkup(text);
  return (
    <>
      {segments.map((segment, index) =>
        segment.italic ? (
          <em className="resume-italic" key={index}>
            {segment.text}
          </em>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
