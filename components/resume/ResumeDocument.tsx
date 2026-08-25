/**
 * The resume document itself (SPEC §7, §11.1).
 *
 * One component turning a resolved render model into the printed page, shared
 * verbatim by the `/render` route Puppeteer prints (§8) and by the editor's
 * live preview (§7). The editor is only allowed to be a faithful preview if
 * both paths run the *same* code, so the section mapping lives here rather
 * than in either route.
 */
import type { RenderModel } from "@/lib/data/resolve";
import { SECTION_TITLE } from "@/lib/render/section-titles";

import { PagedDocument } from "./PagedDocument";
import { ResumeHeader } from "./ResumeHeader";
import { ResumeSection } from "./ResumeSection";
import { ResumeSectionBody } from "./ResumeSectionBody";

export function ResumeDocument({ model }: { model: RenderModel }) {
  return (
    <PagedDocument>
      {model.sections.map((section, index) => {
        const key = `${section.type}-${index}`;
        if (section.type === "header") {
          return (
            <ResumeHeader
              header={section.header}
              key={key}
              mode={section.mode}
              showTitle={section.showTitle}
            />
          );
        }
        const title =
          section.type === "custom" ? section.section.title : SECTION_TITLE[section.type];
        return (
          <ResumeSection key={key} type={section.type} title={title}>
            <ResumeSectionBody section={section} />
          </ResumeSection>
        );
      })}
    </PagedDocument>
  );
}
