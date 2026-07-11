import fs from "fs";
import path from "path";
import { marked } from "marked";

const LEGAL_DIR = path.join(process.cwd(), "content", "legal");

export const LEGAL_DOCS = [
  { slug: "terms", title: "Terms of Service" },
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "community-guidelines", title: "Community Guidelines" },
  { slug: "acceptable-use", title: "Acceptable Use Policy" },
  { slug: "creator-agreement", title: "Creator Agreement" },
  { slug: "refund-policy", title: "Refund & Cancellation Policy" },
  { slug: "content-removal", title: "Content Removal & Copyright" },
  { slug: "age-policy", title: "Age Policy (18+)" },
  { slug: "cookie-policy", title: "Cookie Policy" },
  { slug: "grievance", title: "Grievance Redressal" },
] as const;

export function getLegalDoc(slug: string): { title: string; html: string } | null {
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  if (!doc) return null;
  const file = path.join(LEGAL_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const md = fs.readFileSync(file, "utf8");
  const html = marked.parse(md, { async: false }) as string;
  return { title: doc.title, html };
}
