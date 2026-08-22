/**
 * Parses every profile's on-disk data against the schemas in lib/schema.
 * Exits non-zero on the first file that fails, printing the offending paths.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { contentLibrarySchema } from "../lib/schema/library";
import { variantSchema } from "../lib/schema/variant";

const PROFILES_DIR = join(process.cwd(), "data", "profiles");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function report(path: string, error: z.ZodError): never {
  console.error(`FAIL  ${path}`);
  console.error(z.prettifyError(error));
  process.exit(1);
}

let profileIds: string[];
try {
  profileIds = readdirSync(PROFILES_DIR).filter((entry) =>
    statSync(join(PROFILES_DIR, entry)).isDirectory(),
  );
} catch {
  console.error(`FAIL  no profiles directory at ${PROFILES_DIR}`);
  process.exit(1);
}

if (profileIds.length === 0) {
  console.error(`FAIL  no profiles found under ${PROFILES_DIR}`);
  process.exit(1);
}

for (const profileId of profileIds) {
  const libraryPath = join(PROFILES_DIR, profileId, "content-library.json");
  const parsed = contentLibrarySchema.safeParse(readJson(libraryPath));
  if (!parsed.success) report(libraryPath, parsed.error);

  const library = parsed.data;
  console.log(`PASS  ${profileId}/content-library.json`);
  console.log(`      schemaVersion: ${library.schemaVersion}`);
  console.log(
    `      ${library.aboutMe.length} aboutMe, ${library.competencies.length} competencies, ` +
      `${library.experience.length} experience, ${library.projects.length} projects, ` +
      `${library.education.length} education, ${library.skillGroups.length} skill groups, ` +
      `${library.certifications.length} certifications, ${library.languages.length} languages`,
  );

  const variantsDir = join(PROFILES_DIR, profileId, "variants");
  let variantFiles: string[] = [];
  try {
    variantFiles = readdirSync(variantsDir).filter((entry) => entry.endsWith(".json"));
  } catch {
    console.log(`      (no variants directory)`);
    continue;
  }

  for (const file of variantFiles) {
    const variantPath = join(variantsDir, file);
    const result = variantSchema.safeParse(readJson(variantPath));
    if (!result.success) report(variantPath, result.error);

    const variant = result.data;
    const visible = variant.sections.filter((section) => section.visible);
    console.log(`PASS  ${profileId}/variants/${file}`);
    console.log(`      schemaVersion: ${variant.schemaVersion}, tag: ${variant.tag}`);
    console.log(
      `      ${variant.sections.length} sections (${visible.length} visible): ` +
        `${variant.sections.map((section) => section.type).join(", ")}`,
    );
  }
}
