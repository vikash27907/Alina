import Link from "next/link";
import { LEGAL_DOCS } from "@/lib/legal";

export const metadata = { title: "Legal — FunWithU" };

export default function LegalIndex() {
  return (
    <div className="max-w-2xl mx-auto pt-12">
      <h1 className="text-3xl font-bold">Legal & Policies</h1>
      <p className="text-mist mt-2">
        The rules that govern funwithu.in — written to be read. Questions:{" "}
        <a href="mailto:legal@funwithu.in" className="text-blush hover:underline">
          legal@funwithu.in
        </a>
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mt-8">
        {LEGAL_DOCS.map((d) => (
          <Link
            key={d.slug}
            href={`/legal/${d.slug}`}
            className="card p-5 hover:border-violet/60 transition-colors"
          >
            <span className="font-semibold">{d.title}</span>
            <span className="block text-mist text-sm mt-1">Read →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
