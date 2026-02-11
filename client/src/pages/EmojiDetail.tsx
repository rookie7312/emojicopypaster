import { useCallback, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Check, ClipboardCheck, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Emoji } from "@shared/schema";

function generateEmojiContent(emoji: Emoji) {
  const name = emoji.name;
  const cat = emoji.category;
  const lines: string[] = [];
  lines.push(`## What is the ${name} Emoji?`);
  lines.push(`The **${name}** ${emoji.emoji} is part of the **${cat}** category. ${emoji.description || `This emoji is widely used in text messages, social media posts, and online communication.`}`);
  lines.push('');
  lines.push(`## How to Copy the ${name} Emoji`);
  lines.push(`Simply click the **Copy Emoji** button above to copy the ${emoji.emoji} emoji to your clipboard. Then paste it anywhere — in text messages, Instagram captions, Twitter posts, Facebook comments, TikTok bios, emails, and more.`);
  lines.push('');
  lines.push(`## Where to Use ${emoji.emoji}`);
  lines.push(`- **Text Messages & iMessage** — Send the ${emoji.emoji} emoji to friends and family`);
  lines.push(`- **Social Media** — Use ${emoji.emoji} in your Instagram, Twitter, or TikTok posts`);
  lines.push(`- **Emails & Documents** — Add ${emoji.emoji} to emails, Google Docs, or presentations`);
  lines.push(`- **Usernames & Bios** — Stand out with ${emoji.emoji} in your profile`);
  lines.push('');
  lines.push(`## ${name} Emoji on Different Platforms`);
  lines.push(`The ${emoji.emoji} emoji may appear slightly different on Apple (iPhone, iPad, Mac), Google (Android, Chrome), Samsung, Microsoft (Windows), and other platforms. Each company designs their own version, but the meaning remains the same.`);
  lines.push('');
  lines.push(`## Fun Facts About ${emoji.emoji}`);
  lines.push(`- The ${name} emoji is part of the Unicode Standard and works on all modern devices`);
  lines.push(`- You can use this emoji in over 90% of apps and websites worldwide`);
  lines.push(`- This emoji has been copied **${emoji.copyCount ?? 0} times** on EmojiCopyPaster`);
  if (emoji.subcategory) {
    lines.push(`- It belongs to the **${emoji.subcategory}** subcategory within ${cat}`);
  }
  return lines.join('\n');
}

export default function EmojiDetail() {
  const [, params] = useRoute("/emoji/:slug");
  const slug = params?.slug ?? "";
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: emoji, isLoading } = useQuery<Emoji>({
    queryKey: ["/api/emojis", slug],
    queryFn: async () => {
      const res = await fetch(`/api/emojis/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: allEmojis = [] } = useQuery<Emoji[]>({
    queryKey: ["/api/emojis"],
  });

  const copyMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/emojis/${id}/copy`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emojis/trending"] });
    },
  });

  const handleCopy = useCallback(async () => {
    if (!emoji) return;
    try {
      await navigator.clipboard.writeText(emoji.emoji);
      setCopied(true);
      copyMutation.mutate(emoji.id);
      toast({ title: `${emoji.emoji} Copied!`, description: emoji.name });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }, [emoji, copyMutation, toast]);

  const relatedEmojis = emoji
    ? allEmojis.filter(e => e.category === emoji.category && e.id !== emoji.id)
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

  const emojiTitle = emoji ? `${emoji.emoji} ${emoji.name} - Copy & Paste ${emoji.emoji} | EmojiCopyPaster` : "Emoji Not Found | EmojiCopyPaster";
  const emojiDescription = emoji
    ? `${emoji.emoji} Copy and paste the ${emoji.name} emoji instantly! Click to copy ${emoji.emoji} for messages, social media, and more. ${emoji.emoji}`
    : "Emoji not found.";

  if (!emoji) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Helmet>
          <title>Emoji Not Found | EmojiCopyPaster</title>
          <meta name="description" content="The emoji you're looking for could not be found." />
        </Helmet>
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Emoji not found</p>
          <Link href="/">
            <Button data-testid="button-back-home">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const content = generateEmojiContent(emoji);

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
        <title>{emojiTitle}</title>
        <meta name="description" content={emojiDescription} />
        <link rel="canonical" href={`https://emojicopypaster.com/emoji/${slug}`} />
        <meta property="og:title" content={emojiTitle} />
        <meta property="og:description" content={emojiDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://emojicopypaster.com/emoji/${slug}`} />
        <meta property="og:image" content="https://emojicopypaster.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="EmojiCopyPaster" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={emojiTitle} />
        <meta name="twitter:description" content={emojiDescription} />
        <meta name="twitter:image" content="https://emojicopypaster.com/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": `How do I copy the ${emoji.name} emoji?`,
              "acceptedAnswer": { "@type": "Answer", "text": `Simply click on the ${emoji.emoji} emoji and it will be automatically copied to your clipboard. Then use Ctrl+V (or Cmd+V on Mac) to paste it anywhere.` }
            },
            {
              "@type": "Question",
              "name": `Can I use the ${emoji.name} emoji on any device?`,
              "acceptedAnswer": { "@type": "Answer", "text": "Yes! Emojis are universal and work on all modern devices including iPhone, Android, Windows, and Mac computers." }
            },
            {
              "@type": "Question",
              "name": `What does the ${emoji.name} emoji mean?`,
              "acceptedAnswer": { "@type": "Answer", "text": `The ${emoji.name} ${emoji.emoji} emoji is commonly used in ${emoji.category.toLowerCase()} contexts. ${emoji.description || 'Its meaning can vary depending on context and culture.'}` }
            },
            {
              "@type": "Question",
              "name": `Does the ${emoji.name} emoji look the same on iPhone and Android?`,
              "acceptedAnswer": { "@type": "Answer", "text": "Emojis may look slightly different on iPhone (Apple) vs Android (Google) devices. Each platform has its own emoji design style, but the meaning stays the same." }
            },
            {
              "@type": "Question",
              "name": `Can I use the ${emoji.name} emoji in emails?`,
              "acceptedAnswer": { "@type": "Answer", "text": `Yes! You can paste the ${emoji.emoji} emoji into any email client including Gmail, Outlook, Yahoo Mail, and Apple Mail. It works in both the subject line and the body of the email.` }
            }
          ]
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://emojicopypaster.com/" },
            { "@type": "ListItem", "position": 2, "name": emoji.category, "item": `https://emojicopypaster.com/category/${encodeURIComponent(emoji.category)}` },
            { "@type": "ListItem", "position": 3, "name": emoji.name, "item": `https://emojicopypaster.com/emoji/${slug}` }
          ]
        })}</script>
      </Helmet>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-2" data-testid="text-emoji-title">{emoji.emoji} {emoji.name} - Copy & Paste {emoji.emoji}</h2>
        <p className="text-muted-foreground mb-6" data-testid="text-emoji-meta">{emojiDescription}</p>

        <Card className="p-6 mb-8 border-2 border-primary/20">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h3 className="font-semibold" data-testid="text-copy-section-title">Click to Copy</h3>
            <Button
              onClick={handleCopy}
              data-testid="button-copy-emoji"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Emoji
                </>
              )}
            </Button>
          </div>
          <div
            className="bg-muted rounded-md p-4 text-center cursor-pointer hover-elevate"
            onClick={handleCopy}
            data-testid="text-copyable-content"
          >
            <span className="text-6xl">{emoji.emoji}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Click the box or button above to copy</p>
        </Card>

        {relatedEmojis.length > 0 && (
          <Card className="p-4 mb-8">
            <h3 className="font-semibold mb-3" data-testid="text-related-emojis">Related {emoji.category} Emojis — Click to copy:</h3>
            <div className="flex flex-wrap gap-2">
              {relatedEmojis.slice(0, 20).map((rel, i) => (
                <Link key={rel.id} href={`/emoji/${rel.slug}`}>
                  <span
                    className="text-3xl p-2 rounded-md hover-elevate active-elevate-2 cursor-pointer inline-block"
                    data-testid={`emoji-related-${i}`}
                    title={rel.name}
                  >
                    {rel.emoji}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <article className="prose prose-neutral dark:prose-invert max-w-none" data-testid="article-emoji-content">
          {content.split('\n').map((line, i) => {
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

        {relatedEmojis.length > 0 && (
          <section className="mt-8 border-t border-border pt-6">
            <h3 className="font-semibold mb-4" data-testid="text-related-detail">More {emoji.category} Emojis</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {relatedEmojis.slice(0, 12).map(rel => (
                <Link key={rel.id} href={`/emoji/${rel.slug}`}>
                  <Card className="p-3 hover-elevate cursor-pointer text-center">
                    <div className="text-2xl mb-1">{rel.emoji}</div>
                    <div className="text-xs text-muted-foreground truncate">{rel.name}</div>
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
