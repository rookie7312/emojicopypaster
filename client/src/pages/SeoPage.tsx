import { useCallback, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Check, Loader2, ClipboardCheck, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EmojiPage, Emoji } from "@shared/schema";

export default function SeoPage() {
  const [, params] = useRoute("/page/:slug");
  const slug = params?.slug ?? "";
  const [copiedEmoji, setCopiedEmoji] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const { toast } = useToast();

  const { data: page, isLoading, refetch } = useQuery<EmojiPage>({
    queryKey: ["/api/pages", slug],
    queryFn: async () => {
      const res = await fetch(`/api/pages/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: allEmojis = [] } = useQuery<Emoji[]>({
    queryKey: ["/api/emojis"],
  });

  const generateMutation = useMutation({
    mutationFn: async (keyword: string) => {
      const res = await apiRequest("POST", "/api/pages/generate", { keyword });
      return res.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  useEffect(() => {
    if (page && !page.isGenerated && !generateMutation.isPending) {
      generateMutation.mutate(page.keyword);
    }
  }, [page]);

  const handleCopyEmoji = useCallback(async (emojiChar: string) => {
    try {
      await navigator.clipboard.writeText(emojiChar);
      setCopiedEmoji(emojiChar);
      toast({ title: `${emojiChar} Copied!` });
      setTimeout(() => setCopiedEmoji(null), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }, [toast]);

  const handleCopyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      toast({ title: "Copied to clipboard!" });
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }, [toast]);

  const relatedEmojiObjects = page?.relatedEmojis
    ? allEmojis.filter(e => page.relatedEmojis!.includes(e.emoji))
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const seoTitle = page ? `${page.title} | EmojiCopyPaster` : "Page Not Found | EmojiCopyPaster";
  const seoDescription = page?.metaDescription || "Find and copy emojis instantly.";

  if (!page) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Helmet>
          <title>Page Not Found | EmojiCopyPaster</title>
          <meta name="description" content="The page you're looking for could not be found." />
        </Helmet>
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Page not found</p>
          <Link href="/">
            <Button data-testid="button-back-home">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/">
            <h1 className="text-lg font-bold cursor-pointer flex items-center gap-1.5" data-testid="text-page-title">EmojiCopyPaster<ClipboardCheck className="w-4 h-4 inline-block" /></h1>
          </Link>
        </div>
      </header>

      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={`https://emojicopypaster.com/page/${slug}`} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://emojicopypaster.com/page/${slug}`} />
        <meta property="og:image" content="https://emojicopypaster.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="EmojiCopyPaster" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content="https://emojicopypaster.com/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": `How do I copy the ${page.keyword}?`,
              "acceptedAnswer": { "@type": "Answer", "text": `Simply click on the emoji and it will be automatically copied to your clipboard. Then use Ctrl+V (or Cmd+V on Mac) to paste it anywhere.` }
            },
            {
              "@type": "Question",
              "name": `Can I use the ${page.keyword} on any device?`,
              "acceptedAnswer": { "@type": "Answer", "text": "Yes! Emojis are universal and work on all modern devices including iPhone, Android, Windows, and Mac computers." }
            },
            {
              "@type": "Question",
              "name": `What does the ${page.keyword} mean?`,
              "acceptedAnswer": { "@type": "Answer", "text": `The ${page.keyword} is commonly used to express feelings related to ${page.keyword.replace(' emoji', '')}. Its meaning can vary slightly depending on context and culture.` }
            },
            {
              "@type": "Question",
              "name": `Do ${page.keyword}s look the same on iPhone and Android?`,
              "acceptedAnswer": { "@type": "Answer", "text": "Emojis may look slightly different on iPhone (Apple) vs Android (Google) devices. Each platform has its own emoji design style, but the meaning stays the same." }
            },
            {
              "@type": "Question",
              "name": `Can I use ${page.keyword}s in emails?`,
              "acceptedAnswer": { "@type": "Answer", "text": `Yes! You can paste ${page.keyword}s into any email client including Gmail, Outlook, Yahoo Mail, and Apple Mail. They work in both the subject line and the body of the email.` }
            }
          ]
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://emojicopypaster.com/" },
            { "@type": "ListItem", "position": 2, "name": page.title, "item": `https://emojicopypaster.com/page/${slug}` }
          ]
        })}</script>
      </Helmet>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-2" data-testid="text-seo-title">{page.title}</h2>
        <p className="text-muted-foreground mb-6" data-testid="text-seo-meta">{page.metaDescription}</p>

        {page.copyableText && (
          <Card className="p-6 mb-8 border-2 border-primary/20">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="font-semibold" data-testid="text-copy-section-title">Click to Copy</h3>
              <Button
                onClick={() => handleCopyText(page.copyableText!)}
                data-testid="button-copy-text"
              >
                {copiedText ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </div>
            <div
              className="bg-muted rounded-md p-4 max-h-48 overflow-y-auto text-sm break-all cursor-pointer hover-elevate"
              onClick={() => handleCopyText(page.copyableText!)}
              data-testid="text-copyable-content"
            >
              {page.copyableText.length > 2000 ? page.copyableText.slice(0, 2000) + '...' : page.copyableText}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Click the box or button above to copy</p>
          </Card>
        )}

        {/* Related emoji copy grid */}
        {page.relatedEmojis && page.relatedEmojis.length > 0 && (
          <Card className="p-4 mb-8">
            <h3 className="font-semibold mb-3" data-testid="text-related-emojis">Click to copy:</h3>
            <div className="flex flex-wrap gap-2">
              {page.relatedEmojis.map((emojiChar, i) => (
                <button
                  key={i}
                  onClick={() => handleCopyEmoji(emojiChar)}
                  className={`text-3xl p-2 rounded-md hover-elevate active-elevate-2 cursor-pointer emoji-grid-item ${copiedEmoji === emojiChar ? 'copied-animation bg-primary/10' : ''}`}
                  data-testid={`emoji-seo-${i}`}
                  title="Click to copy"
                >
                  {emojiChar}
                  {copiedEmoji === emojiChar && (
                    <Check className="w-3 h-3 text-primary absolute top-0 right-0" />
                  )}
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Content */}
        {generateMutation.isPending ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generating content...</span>
          </div>
        ) : page.content ? (
          <article className="prose prose-neutral dark:prose-invert max-w-none" data-testid="article-seo-content">
            {page.content.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-8 mb-4">{line.slice(2)}</h1>;
              if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
              if (line.startsWith('- ')) {
                const text = line.slice(2);
                return (
                  <li key={i} className="ml-4 mb-1 list-disc">
                    <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  </li>
                );
              }
              if (line.trim() === '') return <br key={i} />;
              return (
                <p key={i} className="mb-3 leading-relaxed text-muted-foreground">
                  <span dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} />
                </p>
              );
            })}
          </article>
        ) : (
          <p className="text-muted-foreground" data-testid="text-no-content">Content will be generated shortly.</p>
        )}

        {/* Related emoji details */}
        {relatedEmojiObjects.length > 0 && (
          <section className="mt-8 border-t border-border pt-6">
            <h3 className="font-semibold mb-4" data-testid="text-related-detail">Related Emojis</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {relatedEmojiObjects.slice(0, 12).map(emoji => (
                <Link key={emoji.id} href={`/emoji/${emoji.slug}`}>
                  <Card className="p-3 hover-elevate cursor-pointer text-center">
                    <div className="text-2xl mb-1">{emoji.emoji}</div>
                    <div className="text-xs text-muted-foreground truncate">{emoji.name}</div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border py-6 mt-8">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <Link href="/">
            <span className="hover:text-foreground transition-colors cursor-pointer" data-testid="link-footer-home">
              Back to all emojis
            </span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
