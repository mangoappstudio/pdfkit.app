import Link from "next/link";

interface ToolSeoFooterProps {
  title: string;
  description: string;
  learnMoreHref?: string;
  bullets: string[];
  faqs?: Array<{ question: string; answer: string }>;
}

export function ToolSeoFooter({
  title,
  description,
  learnMoreHref,
  bullets,
  faqs,
}: ToolSeoFooterProps) {
  return (
    <section className="bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-gray-900">About {title}</h2>
            <p className="text-sm text-gray-600">{description}</p>
            {learnMoreHref ? (
              <Link href={learnMoreHref} className="text-sm text-blue-600 hover:text-blue-800 transition-colors">
                Learn more →
              </Link>
            ) : null}
          </div>

          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-gray-400">
                  •
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          {faqs && faqs.length > 0 ? (
            <div className="mt-7">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">FAQ</h3>
              <div className="space-y-2">
                {faqs.map((faq) => (
                  <details key={faq.question} className="rounded-lg border border-gray-200 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-900">{faq.question}</summary>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

