import Link from "next/link";
import { notFound } from "next/navigation";
import { getLegalDoc, LEGAL_DOCS } from "@/lib/legal";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const doc = getLegalDoc(params.slug);
  return { title: doc ? `${doc.title} — FunWithU` : "Legal — FunWithU" };
}

export default function LegalDoc({ params }: { params: { slug: string } }) {
  const doc = getLegalDoc(params.slug);
  if (!doc) notFound();

  return (
    <div className="max-w-3xl mx-auto pt-10 pb-16">
      <Link href="/legal" className="text-mist text-sm hover:text-white">
        ← All policies
      </Link>
      <article
        className="legal-prose card p-6 sm:p-10 mt-4"
        dangerouslySetInnerHTML={{ __html: doc.html }}
      />
    </div>
  );
}
