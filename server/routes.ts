import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { EMOJI_DATA, TOP_KEYWORDS, generateSeoPages } from "./seed-emojis";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // === Emojis ===
  app.get("/api/emojis/categories", async (_req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  app.get("/api/emojis/trending", async (_req, res) => {
    const trending = await storage.getTrending(50);
    res.json(trending);
  });

  app.get("/api/emojis", async (req, res) => {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const emojis = await storage.getEmojis(search, category);
    res.json(emojis);
  });

  app.get("/api/emojis/:slug", async (req, res) => {
    const emoji = await storage.getEmojiBySlug(req.params.slug);
    if (!emoji) return res.status(404).json({ message: "Emoji not found" });
    res.json(emoji);
  });

  app.post("/api/emojis/:id/copy", async (req, res) => {
    const id = Number(req.params.id);
    const copyCount = await storage.incrementCopyCount(id);
    res.json({ copyCount });
  });

  // === SEO Pages ===
  app.get("/api/pages", async (_req, res) => {
    const pages = await storage.getPages();
    res.json(pages);
  });

  app.get("/api/pages/:slug", async (req, res) => {
    const page = await storage.getPageBySlug(req.params.slug);
    if (!page) return res.status(404).json({ message: "Page not found" });
    res.json(page);
  });

  app.patch("/api/pages/:id", async (req, res) => {
    const id = Number(req.params.id);
    const { title, metaDescription, content } = req.body;
    try {
      const updated = await storage.updatePage(id, { title, metaDescription, content });
      if (!updated) return res.status(404).json({ message: "Page not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating page:", error);
      res.status(500).json({ message: "Failed to update page" });
    }
  });

  app.delete("/api/pages/all", async (_req, res) => {
    try {
      const count = await storage.deleteAllPages();
      res.json({ deleted: count });
    } catch (error) {
      console.error("Error deleting all pages:", error);
      res.status(500).json({ message: "Failed to delete all pages" });
    }
  });

  app.delete("/api/pages/:id", async (req, res) => {
    const id = Number(req.params.id);
    try {
      await storage.deletePage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting page:", error);
      res.status(500).json({ message: "Failed to delete page" });
    }
  });

  app.post("/api/pages/add-keywords", async (req, res) => {
    try {
      const { keywords } = req.body;
      if (!Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ message: "Keywords array is required" });
      }

      const existingPages = await storage.getPages();
      const existingSlugs = new Set(existingPages.map(p => p.slug));
      let added = 0;
      let skipped = 0;

      for (const kw of keywords) {
        const keyword = kw.trim();
        if (!keyword) continue;
        const slug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (existingSlugs.has(slug)) {
          skipped++;
          continue;
        }
        const titleWord = keyword.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        await storage.createPage({
          slug,
          title: titleWord,
          keyword,
          isGenerated: false,
        });
        existingSlugs.add(slug);
        added++;
      }

      res.json({ added, skipped, total: added + skipped });
    } catch (error) {
      console.error("Error adding keywords:", error);
      res.status(500).json({ message: "Failed to add keywords" });
    }
  });

  app.post("/api/pages/generate", async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ message: "Keyword is required" });

    try {
      const existingPage = await storage.getPageBySlug(
        keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      );

      if (existingPage && existingPage.isGenerated) {
        if (existingPage.copyableText !== null) {
          return res.json(existingPage);
        }
      }

      let emojiSearchTerm = keyword.replace(/\s*emoji\s*/gi, ' ').replace(/\s*\d+\s*times?\s*/gi, ' ').trim();
      let allEmojis = await storage.getEmojis(emojiSearchTerm);
      if (allEmojis.length === 0) {
        allEmojis = await smartEmojiSearch(emojiSearchTerm, storage);
      }
      const relatedEmojiChars = allEmojis.slice(0, 20).map(e => e.emoji);

      const content = generateSeoContent(keyword, allEmojis);
      const copyableText = generateCopyableText(keyword, allEmojis);

      const titleWord = keyword.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const topThree = relatedEmojiChars.slice(0, 3).join('');

      if (existingPage) {
        const updated = await storage.updatePage(existingPage.id, {
          title: `${topThree} ${titleWord} - Copy & Paste ${topThree}`,
          metaDescription: `${topThree} Copy and paste ${keyword} instantly! Find the best ${keyword} for messages, social media, and more. ${topThree}`,
          content,
          copyableText,
          relatedEmojis: relatedEmojiChars,
          isGenerated: true,
        });
        return res.json(updated);
      }
      const page = await storage.createPage({
        slug: keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        title: `${topThree} ${titleWord} - Copy & Paste ${topThree}`,
        keyword,
        metaDescription: `${topThree} Copy and paste ${keyword} instantly! Find the best ${keyword} for messages, social media, and more. ${topThree}`,
        content,
        copyableText,
        relatedEmojis: relatedEmojiChars,
        isGenerated: true,
      });

      res.status(201).json(page);
    } catch (error) {
      console.error("Error generating page:", error);
      res.status(500).json({ message: "Failed to generate page" });
    }
  });

  app.post("/api/pages/generate-emoji-pages", async (_req, res) => {
    try {
      const allEmojisInDb = await storage.getEmojis();
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const emojiItem of allEmojisInDb) {
        const keyword = `${emojiItem.name.toLowerCase()} emoji`;
        const slug = keyword.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const existing = await storage.getPageBySlug(slug);
        if (existing && existing.isGenerated) {
          skipped++;
          continue;
        }

        let emojiSearchTerm = keyword.replace(/\s*emoji\s*/gi, ' ').trim();
        let relatedEmojis = await storage.getEmojis(emojiSearchTerm);
        if (relatedEmojis.length === 0) {
          relatedEmojis = await smartEmojiSearch(emojiSearchTerm, storage);
        }
        const relatedEmojiChars = relatedEmojis.slice(0, 20).map(e => e.emoji);
        const content = generateSeoContent(keyword, relatedEmojis);
        const copyableText = generateCopyableText(keyword, relatedEmojis);
        const titleWord = keyword.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const topThree = relatedEmojiChars.slice(0, 3).join('');

        const pageData = {
          title: `${topThree} ${titleWord} - Copy & Paste ${topThree}`,
          metaDescription: `${topThree} Copy and paste ${keyword} instantly! Find the best ${keyword} for messages, social media, and more. ${topThree}`,
          content,
          copyableText,
          relatedEmojis: relatedEmojiChars,
          isGenerated: true,
        };

        if (existing) {
          await storage.updatePage(existing.id, pageData);
          updated++;
        } else {
          await storage.createPage({ slug, keyword, ...pageData });
          created++;
        }
      }

      res.json({ created, updated, skipped, total: allEmojisInDb.length });
    } catch (error) {
      console.error("Error generating emoji pages:", error);
      res.status(500).json({ message: "Failed to generate emoji pages" });
    }
  });

  app.post("/api/pages/generate-batch", async (_req, res) => {
    try {
      const ungenerated = await storage.getUngeneratedPages(5);
      let generated = 0;

      for (const page of ungenerated) {
        let batchSearchTerm = page.keyword.replace(/\s*emoji\s*/gi, ' ').replace(/\s*\d+\s*times?\s*/gi, ' ').trim();
        let allEmojis = await storage.getEmojis(batchSearchTerm);
        if (allEmojis.length === 0) {
          allEmojis = await smartEmojiSearch(batchSearchTerm, storage);
        }
        const relatedEmojiChars = allEmojis.slice(0, 20).map(e => e.emoji);
        const content = generateSeoContent(page.keyword, allEmojis);
        const copyableText = generateCopyableText(page.keyword, allEmojis);
        const titleWord = page.keyword.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const topThree = relatedEmojiChars.slice(0, 3).join('');

        await storage.updatePage(page.id, {
          title: `${topThree} ${titleWord} - Copy & Paste ${topThree}`,
          metaDescription: `${topThree} Copy and paste ${page.keyword} instantly! Find the best ${page.keyword} for messages, social media, and more. ${topThree}`,
          content,
          copyableText,
          relatedEmojis: relatedEmojiChars,
          isGenerated: true,
        });
        generated++;
      }

      res.json({ generated });
    } catch (error) {
      console.error("Error batch generating:", error);
      res.status(500).json({ message: "Failed to batch generate" });
    }
  });

  // Sitemap.xml for SEO
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const emojis = await storage.getEmojis();
      const pages = await storage.getPages();
      const categories = await storage.getCategories();
      const baseUrl = "https://emojicopypaster.com";
      const today = new Date().toISOString().split('T')[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>`;

      for (const cat of categories) {
        xml += `\n  <url><loc>${baseUrl}/category/${encodeURIComponent(cat.toLowerCase().replace(/\s+/g, '-'))}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
      }

      for (const emoji of emojis) {
        xml += `\n  <url><loc>${baseUrl}/emoji/${emoji.slug}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`;
      }

      for (const page of pages.filter(p => p.isGenerated)) {
        xml += `\n  <url><loc>${baseUrl}/page/${page.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
      }

      xml += `\n</urlset>`;

      res.set("Content-Type", "application/xml");
      res.send(xml);
    } catch (error) {
      res.status(500).send("Error generating sitemap");
    }
  });

  // robots.txt
  app.get("/robots.txt", (_req, res) => {
    res.set("Content-Type", "text/plain");
    res.send(`User-agent: *
Allow: /
Sitemap: https://emojicopypaster.com/sitemap.xml`);
  });

  // Seed data on startup
  await seedDatabase();

  return httpServer;
}

const STOP_WORDS = new Set(['i', 'a', 'an', 'the', 'to', 'in', 'on', 'at', 'it', 'is', 'am', 'are', 'was', 'be', 'my', 'me', 'we', 'us', 'he', 'she', 'his', 'her', 'you', 'your', 'of', 'for', 'and', 'or', 'but', 'not', 'no', 'so', 'if', 'do', 'up', 'out', 'all', 'just', 'get', 'got', 'has', 'had', 'can', 'will', 'one', 'two', 'with', 'this', 'that', 'from', 'by', 'as']);

const SYNONYM_MAP: Record<string, string[]> = {
  'hate': ['angry', 'mad', 'rage'],
  'love': ['heart', 'love'],
  'sad': ['cry', 'sad', 'tear'],
  'laugh': ['laugh', 'lol', 'funny', 'joy'],
  'cry': ['cry', 'sad', 'tear'],
  'cool': ['cool', 'sunglasses'],
  'kiss': ['kiss', 'love'],
  'hug': ['hug', 'love'],
  'think': ['think', 'hmm'],
  'sleep': ['sleep', 'zzz', 'tired'],
  'sick': ['sick', 'ill', 'nauseated'],
  'scared': ['scared', 'fear', 'scream'],
  'surprise': ['surprise', 'wow', 'shock'],
  'celebrate': ['party', 'celebrate', 'tada'],
  'pray': ['pray', 'hope', 'please'],
  'clap': ['clap', 'applause'],
  'wave': ['wave', 'hello', 'bye'],
  'thank': ['pray', 'thanks', 'grateful'],
  'sorry': ['sad', 'sorry', 'apologize'],
  'miss': ['sad', 'cry', 'heart'],
  'happy': ['happy', 'smile', 'joy'],
  'angry': ['angry', 'mad', 'rage'],
  'wink': ['wink', 'flirt'],
  'poop': ['poop', 'poo'],
  'money': ['money', 'dollar', 'rich'],
  'star': ['star', 'sparkle'],
  'sun': ['sun', 'sunny'],
  'rain': ['rain', 'umbrella'],
  'snow': ['snow', 'cold'],
  'hot': ['fire', 'hot'],
  'cold': ['cold', 'freeze', 'snow'],
  'dead': ['skull', 'dead'],
  'death': ['skull', 'dead'],
  'evil': ['devil', 'evil', 'angry'],
  'devil': ['devil', 'evil'],
  'ghost': ['ghost', 'spooky'],
  'alien': ['alien', 'ufo'],
  'robot': ['robot', 'mechanical'],
  'cat': ['cat', 'kitten'],
  'dog': ['dog', 'puppy'],
  'pig': ['pig', 'oink'],
  'monkey': ['monkey', 'ape'],
  'chicken': ['chicken', 'bird'],
  'bear': ['bear', 'teddy'],
  'broken': ['broken', 'heart'],
  'peace': ['peace', 'victory'],
  'okay': ['ok', 'thumbs'],
  'thumbs': ['thumbs', 'like'],
  'rock': ['rock', 'metal'],
  'strong': ['muscle', 'strong', 'flex'],
  'muscle': ['muscle', 'flex', 'strong'],
  'eye': ['eye', 'eyes', 'look'],
  'nose': ['nose', 'sniff'],
  'tongue': ['tongue', 'taste'],
  'ear': ['ear', 'listen'],
  'brain': ['brain', 'think'],
  'hand': ['hand', 'wave'],
  'fist': ['fist', 'punch'],
  'finger': ['finger', 'point'],
};

async function smartEmojiSearch(searchTerm: string, storage: any): Promise<any[]> {
  const meaningfulWords = searchTerm.split(/\s+/).filter(w => !STOP_WORDS.has(w.toLowerCase()));
  for (const word of meaningfulWords) {
    const synonyms = SYNONYM_MAP[word.toLowerCase()];
    if (synonyms) {
      for (const syn of synonyms) {
        const results = await storage.getEmojis(syn);
        if (results.length > 0) return results;
      }
    }
    const results = await storage.getEmojis(word);
    if (results.length > 0) return results;
  }
  return [];
}

function generateCopyableText(keyword: string, relatedEmojis: any[]): string | null {
  const timesMatch = keyword.match(/^(.+?)\s+(\d+)\s*times?$/i);
  if (timesMatch) {
    const phrase = timesMatch[1].trim();
    const count = Math.min(parseInt(timesMatch[2], 10), 10000);

    const emojiPhrase = phrase.replace(/\s*emoji\s*/gi, ' ').trim();
    if (phrase.toLowerCase().includes('emoji')) {
      const phraseLower = emojiPhrase.toLowerCase();
      const phraseWords = phraseLower.split(/\s+/).filter(w => !STOP_WORDS.has(w));
      const match = relatedEmojis.find(e => {
        const name = e.name?.toLowerCase() || '';
        const kws = (e.keywords || []).map((k: string) => k.toLowerCase());
        return name.includes(phraseLower) || phraseLower.includes(name) ||
               kws.some((k: string) => phraseLower.includes(k)) ||
               phraseWords.some(pw => name.includes(pw) || kws.includes(pw));
      });
      if (match) {
        return (match.emoji + ' ').repeat(count).trim();
      }
      if (relatedEmojis.length > 0) {
        return (relatedEmojis[0].emoji + ' ').repeat(count).trim();
      }
    }

    return (phrase + ' ').repeat(count).trim();
  }

  const repeatMatch = keyword.match(/^(\d+)\s+(.+?)(?:\s+emoji)?s?$/i);
  if (repeatMatch) {
    const count = Math.min(parseInt(repeatMatch[1], 10), 10000);
    const phrase = repeatMatch[2].trim();
    const emojiChars = relatedEmojis.slice(0, count).map(e => e.emoji);
    if (emojiChars.length > 0) {
      const result: string[] = [];
      for (let i = 0; i < count; i++) {
        result.push(emojiChars[i % emojiChars.length]);
      }
      return result.join('');
    }
  }

  if (relatedEmojis.length > 0) {
    return relatedEmojis.slice(0, 20).map(e => e.emoji).join(' ');
  }

  return null;
}

function generateSeoContent(keyword: string, relatedEmojis: any[]): string {
  const title = keyword.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const emojiSamples = relatedEmojis.slice(0, 10).map(e => `${e.emoji} ${e.name}`).join(', ');
  const cleanKeyword = keyword.replace(' emoji', '');

  return `# ${title} - Copy & Paste

Looking for the perfect **${keyword}** to use in your messages? You've come to the right place! Simply click any emoji below to copy it to your clipboard instantly.

## Popular ${title}s

${relatedEmojis.slice(0, 10).map(e => `- ${e.emoji} **${e.name}** - ${e.description || 'A popular emoji for expressing ' + cleanKeyword}`).join('\n')}

## How to Use ${title}

Using ${keyword}s is easy! Just click on any emoji above and it will be copied to your clipboard. Then paste it anywhere - in text messages, social media posts, emails, or documents.

### How to Use ${title} on iPhone

1. Visit this page on your iPhone's Safari or Chrome browser
2. Tap the ${keyword} you want to copy
3. The emoji is now copied to your clipboard
4. Open any app like iMessage, WhatsApp, Instagram, or Notes
5. Tap and hold the text field and select **Paste**
6. You can also access emojis through your iPhone keyboard by tapping the smiley face icon

### How to Use ${title} on Android

1. Open this page in Chrome or any browser on your Android phone
2. Tap the ${keyword} you want to use
3. It will be copied to your clipboard automatically
4. Switch to any app like Messages, WhatsApp, Telegram, or Facebook
5. Long press in the text field and tap **Paste**
6. Android users can also find emojis by tapping the emoji icon on the Gboard keyboard

### How to Use ${title} on PC (Windows & Mac)

1. Open this page on your computer browser (Chrome, Firefox, Edge, or Safari)
2. Click on the ${keyword} you want to copy
3. The emoji is instantly copied to your clipboard
4. Open any app or website where you want to paste it
5. Press **Ctrl+V** (Windows) or **Cmd+V** (Mac) to paste
6. On Windows, you can also press **Win + .** (period) to open the emoji picker. On Mac, press **Ctrl + Cmd + Space**

## About ${title}

The ${keyword} is one of the most popular emojis used in digital communication. It helps convey emotions and add personality to text-based conversations. ${relatedEmojis.length > 0 ? `Related emojis include ${emojiSamples}.` : ''}

## Frequently Asked Questions

### How do I copy the ${keyword}?
Simply click on the emoji and it will be automatically copied to your clipboard. Then use Ctrl+V (or Cmd+V on Mac) to paste it anywhere.

### Can I use the ${keyword} on any device?
Yes! Emojis are universal and work on all modern devices including iPhone, Android, Windows, and Mac computers.

### What does the ${keyword} mean?
The ${keyword} is commonly used to express feelings related to ${cleanKeyword}. Its meaning can vary slightly depending on context and culture.

### Do ${keyword}s look the same on iPhone and Android?
${title}s may look slightly different on iPhone (Apple) vs Android (Google) devices. Each platform has its own emoji design style, but the meaning stays the same.

### Can I use ${keyword}s in emails?
Yes! You can paste ${keyword}s into any email client including Gmail, Outlook, Yahoo Mail, and Apple Mail. They work in both the subject line and the body of the email.`;
}

async function seedDatabase() {
  const count = await storage.getEmojiCount();
  if (count > 0) {
    console.log(`Database already has ${count} emojis, skipping seed.`);
    return;
  }

  console.log("Seeding emoji database...");

  // Insert emojis in batches
  const batchSize = 50;
  for (let i = 0; i < EMOJI_DATA.length; i += batchSize) {
    const batch = EMOJI_DATA.slice(i, i + batchSize);
    await storage.createEmojis(batch);
  }

  console.log(`Seeded ${EMOJI_DATA.length} emojis.`);

  // Create SEO pages (not yet generated)
  const seoPages = generateSeoPages(TOP_KEYWORDS);
  for (const page of seoPages) {
    try {
      await storage.createPage(page);
    } catch (e) {
      // Ignore duplicates
    }
  }

  console.log(`Created ${seoPages.length} SEO page stubs.`);
}
