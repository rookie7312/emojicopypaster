const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const OUTPUT_DIR = path.join(__dirname, 'static-site');

async function fetchJSON(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`);
  return res.json();
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMarkdown(content) {
  if (!content) return '';
  return content.split('\n').map(line => {
    if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
    if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
    if (line.startsWith('- ')) {
      const text = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<li>${text}</li>`;
    }
    if (line.trim() === '') return '';
    const text = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return `<p>${text}</p>`;
  }).join('\n');
}

function pageTemplate(title, metaDesc, body, canonical = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(metaDesc)}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(metaDesc)}">
  ${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fredoka:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #fafafa; color: #1a1a1a; line-height: 1.6; }
    a { color: inherit; text-decoration: none; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 16px; }
    header { background: #fff; border-bottom: 1px solid #e5e5e5; padding: 12px 0; position: sticky; top: 0; z-index: 50; }
    header .inner { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .logo { font-family: 'Fredoka', sans-serif; font-size: 1.25rem; font-weight: 600; color: #1a1a1a; }
    .search-box { flex: 1; min-width: 200px; max-width: 400px; }
    .search-box input { width: 100%; padding: 8px 12px; border: 1px solid #e5e5e5; border-radius: 6px; font-size: 14px; outline: none; }
    .search-box input:focus { border-color: #6366f1; }
    .hero { text-align: center; padding: 40px 16px; background: linear-gradient(135deg, #f0f0ff, #fdf2f8); }
    .hero h1 { font-family: 'Fredoka', sans-serif; font-size: 2rem; margin-bottom: 8px; }
    .hero p { color: #666; max-width: 600px; margin: 0 auto; }
    .categories { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 0; justify-content: center; }
    .cat-badge { padding: 6px 14px; border-radius: 20px; background: #f3f4f6; border: 1px solid #e5e5e5; font-size: 13px; cursor: pointer; transition: background 0.2s; }
    .cat-badge:hover, .cat-badge.active { background: #6366f1; color: #fff; border-color: #6366f1; }
    .section { padding: 24px 0; }
    .section h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 16px; }
    .emoji-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 8px; }
    .emoji-btn { font-size: 2rem; padding: 8px; border: none; background: #fff; border-radius: 8px; cursor: pointer; text-align: center; transition: transform 0.15s, box-shadow 0.15s; border: 1px solid #f0f0f0; }
    .emoji-btn:hover { transform: scale(1.1); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .emoji-btn:active { transform: scale(0.95); }
    .category-section { margin-bottom: 32px; }
    .category-section h2 { display: flex; align-items: center; justify-content: space-between; }
    .category-section h2 a { font-size: 13px; color: #6366f1; font-weight: 500; }
    .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; margin-bottom: 16px; }
    .emoji-detail { text-align: center; }
    .emoji-detail .big { font-size: 5rem; margin-bottom: 16px; }
    .emoji-detail h1 { font-size: 1.5rem; margin-bottom: 8px; }
    .copy-btn { background: #6366f1; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 15px; cursor: pointer; margin: 8px 4px; }
    .copy-btn:hover { background: #4f46e5; }
    .breadcrumb { padding: 12px 0; font-size: 13px; color: #888; }
    .breadcrumb a { color: #6366f1; }
    .tag { display: inline-block; padding: 4px 10px; background: #f3f4f6; border-radius: 12px; font-size: 12px; margin: 2px; }
    .seo-content h1, .seo-content h2, .seo-content h3 { margin: 24px 0 12px; }
    .seo-content h1 { font-size: 1.5rem; }
    .seo-content h2 { font-size: 1.25rem; }
    .seo-content h3 { font-size: 1.1rem; }
    .seo-content p { margin-bottom: 12px; color: #444; }
    .seo-content li { margin-left: 24px; margin-bottom: 4px; list-style: disc; color: #444; }
    .seo-content strong { color: #1a1a1a; }
    .seo-pages-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; }
    .seo-pages-list a { padding: 10px 14px; background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; font-size: 13px; transition: border-color 0.2s; }
    .seo-pages-list a:hover { border-color: #6366f1; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; }
    .related-card { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; text-align: center; }
    .related-card .emoji { font-size: 1.5rem; }
    .related-card .name { font-size: 11px; color: #888; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    footer { border-top: 1px solid #e5e5e5; padding: 24px 0; text-align: center; color: #888; font-size: 13px; margin-top: 32px; }
    footer a { color: #6366f1; }
    .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #1a1a1a; color: #fff; padding: 10px 20px; border-radius: 8px; font-size: 14px; z-index: 999; display: none; }
    .toast.show { display: block; animation: fadeInOut 1.5s; }
    @keyframes fadeInOut { 0% { opacity: 0; } 10% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
    @media (max-width: 640px) {
      .hero h1 { font-size: 1.5rem; }
      .emoji-grid { grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); }
      .emoji-btn { font-size: 1.5rem; padding: 6px; }
    }
  </style>
  <script>
    function copyEmoji(emoji) {
      navigator.clipboard.writeText(emoji).then(function() {
        var t = document.getElementById('toast');
        t.textContent = emoji + ' Copied!';
        t.className = 'toast show';
        setTimeout(function() { t.className = 'toast'; }, 1500);
      });
    }
  </script>
</head>
<body>
  ${body}
  <div id="toast" class="toast"></div>
</body>
</html>`;
}

function navHtml() {
  return `<header>
    <div class="container inner">
      <a href="/" class="logo">EmojiCopyPaster</a>
    </div>
  </header>`;
}

function footerHtml(pages) {
  const links = (pages || []).filter(p => p.isGenerated).slice(0, 20).map(p =>
    `<a href="/page/${p.slug}.html">${escapeHtml(p.title)}</a>`
  ).join(' &middot; ');
  return `<footer>
    <div class="container">
      <p><a href="/">EmojiCopyPaster</a> - Copy & Paste Emojis Instantly</p>
      ${links ? `<p style="margin-top:8px">${links}</p>` : ''}
    </div>
  </footer>`;
}

async function generateHomePage(emojis, categories, trending, pages) {
  const grouped = {};
  for (const e of emojis) {
    if (!grouped[e.category]) grouped[e.category] = [];
    grouped[e.category].push(e);
  }

  const catBadges = categories.map(c =>
    `<a href="/category/${encodeURIComponent(c)}.html" class="cat-badge">${escapeHtml(c)}</a>`
  ).join('\n');

  const trendingHtml = trending.slice(0, 20).map(e =>
    `<button class="emoji-btn" onclick="copyEmoji('${e.emoji}')" title="${escapeHtml(e.name)}">${e.emoji}</button>`
  ).join('\n');

  const categorySections = Object.entries(grouped).map(([cat, list]) => {
    const grid = list.slice(0, 40).map(e =>
      `<button class="emoji-btn" onclick="copyEmoji('${e.emoji}')" title="${escapeHtml(e.name)}">${e.emoji}</button>`
    ).join('\n');
    return `<div class="category-section">
      <h2>${escapeHtml(cat)} <a href="/category/${encodeURIComponent(cat)}.html">View all &rarr;</a></h2>
      <div class="emoji-grid">${grid}</div>
    </div>`;
  }).join('\n');

  const seoLinks = pages.filter(p => p.isGenerated).slice(0, 30).map(p =>
    `<a href="/page/${p.slug}.html">${escapeHtml(p.title)}</a>`
  ).join('\n');

  const body = `
    ${navHtml()}
    <div class="hero">
      <h1>Copy & Paste Emojis Instantly</h1>
      <p>Click any emoji to copy it to your clipboard. Browse 400+ emojis organized by category.</p>
    </div>
    <div class="container">
      <div class="categories">${catBadges}</div>
      
      <div class="section">
        <h2>Trending Emojis</h2>
        <div class="emoji-grid">${trendingHtml}</div>
      </div>

      ${categorySections}

      ${seoLinks ? `<div class="section">
        <h2>Popular Emoji Pages</h2>
        <div class="seo-pages-list">${seoLinks}</div>
      </div>` : ''}
    </div>
    ${footerHtml(pages)}`;

  const html = pageTemplate(
    'EmojiCopyPaster - Copy & Paste Emojis Instantly',
    'Copy and paste emojis instantly! Browse 400+ emojis by category, search, and click to copy. Free emoji tool for messages, social media, and more.',
    body
  );
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html);
  console.log('Generated: index.html');
}

async function generateCategoryPages(emojis, categories, pages) {
  const catDir = path.join(OUTPUT_DIR, 'category');
  fs.mkdirSync(catDir, { recursive: true });

  for (const cat of categories) {
    const catEmojis = emojis.filter(e => e.category === cat);
    const grid = catEmojis.map(e =>
      `<button class="emoji-btn" onclick="copyEmoji('${e.emoji}')" title="${escapeHtml(e.name)}">${e.emoji}</button>`
    ).join('\n');

    const emojiLinks = catEmojis.slice(0, 30).map(e =>
      `<a href="/emoji/${e.slug}.html" class="related-card"><div class="emoji">${e.emoji}</div><div class="name">${escapeHtml(e.name)}</div></a>`
    ).join('\n');

    const body = `
      ${navHtml()}
      <div class="container">
        <div class="breadcrumb"><a href="/">Home</a> &rsaquo; ${escapeHtml(cat)}</div>
        <h1>${escapeHtml(cat)} Emojis - Copy & Paste</h1>
        <p style="color:#666;margin-bottom:24px">Browse and copy ${escapeHtml(cat)} emojis. Click any emoji to copy it to your clipboard instantly.</p>
        <div class="emoji-grid" style="margin-bottom:32px">${grid}</div>
        <h2>All ${escapeHtml(cat)} Emojis</h2>
        <div class="related-grid" style="margin-bottom:32px">${emojiLinks}</div>
      </div>
      ${footerHtml(pages)}`;

    const html = pageTemplate(
      `${cat} Emojis - Copy & Paste | EmojiCopyPaster`,
      `Browse and copy ${cat} emojis. Click to copy any emoji to your clipboard instantly. Free emoji copy and paste tool.`,
      body
    );
    fs.writeFileSync(path.join(catDir, `${encodeURIComponent(cat)}.html`), html);
    console.log(`Generated: category/${cat}.html`);
  }
}

async function generateEmojiPages(emojis, pages) {
  const emojiDir = path.join(OUTPUT_DIR, 'emoji');
  fs.mkdirSync(emojiDir, { recursive: true });

  for (const emoji of emojis) {
    const keywords = (emoji.keywords || []).map(k => `<span class="tag">${escapeHtml(k)}</span>`).join('');
    const related = emojis.filter(e => e.category === emoji.category && e.id !== emoji.id).slice(0, 8);
    const relatedHtml = related.map(e =>
      `<a href="/emoji/${e.slug}.html" class="related-card"><div class="emoji">${e.emoji}</div><div class="name">${escapeHtml(e.name)}</div></a>`
    ).join('\n');

    const body = `
      ${navHtml()}
      <div class="container">
        <div class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/category/${encodeURIComponent(emoji.category)}.html">${escapeHtml(emoji.category)}</a> &rsaquo; ${escapeHtml(emoji.name)}</div>
        <div class="card emoji-detail">
          <div class="big">${emoji.emoji}</div>
          <h1>${escapeHtml(emoji.name)}</h1>
          <p style="color:#888;margin-bottom:12px">${escapeHtml(emoji.category)}</p>
          <button class="copy-btn" onclick="copyEmoji('${emoji.emoji}')">Copy ${emoji.emoji}</button>
          ${emoji.description ? `<p style="margin-top:16px;color:#666">${escapeHtml(emoji.description)}</p>` : ''}
          ${keywords ? `<div style="margin-top:12px">${keywords}</div>` : ''}
        </div>
        ${relatedHtml ? `<div class="section"><h2>Related ${escapeHtml(emoji.category)} Emojis</h2><div class="related-grid">${relatedHtml}</div></div>` : ''}
      </div>
      ${footerHtml(pages)}`;

    const html = pageTemplate(
      `${emoji.emoji} ${emoji.name} Emoji - Copy & Paste | EmojiCopyPaster`,
      `Copy the ${emoji.name} ${emoji.emoji} emoji. ${emoji.description || ''} Click to copy and paste anywhere.`,
      body
    );
    fs.writeFileSync(path.join(emojiDir, `${emoji.slug}.html`), html);
  }
  console.log(`Generated: ${emojis.length} emoji pages`);
}

async function generateSeoPages(allEmojis, pages) {
  const pageDir = path.join(OUTPUT_DIR, 'page');
  fs.mkdirSync(pageDir, { recursive: true });

  const generated = pages.filter(p => p.isGenerated && p.content);
  for (const page of generated) {
    const relatedEmojis = (page.relatedEmojis || []).map(ec => {
      const found = allEmojis.find(e => e.emoji === ec);
      return found ? `<button class="emoji-btn" onclick="copyEmoji('${ec}')" title="${escapeHtml(found.name)}">${ec}</button>` : `<button class="emoji-btn" onclick="copyEmoji('${ec}')">${ec}</button>`;
    }).join('\n');

    const body = `
      ${navHtml()}
      <div class="container">
        <div class="breadcrumb"><a href="/">Home</a> &rsaquo; ${escapeHtml(page.title)}</div>
        <h1>${escapeHtml(page.title)}</h1>
        <p style="color:#888;margin-bottom:24px">${escapeHtml(page.metaDescription || '')}</p>
        ${relatedEmojis ? `<div class="card"><h3 style="margin-bottom:12px">Click to copy:</h3><div class="emoji-grid">${relatedEmojis}</div></div>` : ''}
        <div class="seo-content">${renderMarkdown(page.content)}</div>
      </div>
      ${footerHtml(pages)}`;

    const html = pageTemplate(
      `${page.title} | EmojiCopyPaster`,
      page.metaDescription || `Find and copy emojis instantly.`,
      body
    );
    fs.writeFileSync(path.join(pageDir, `${page.slug}.html`), html);
  }
  console.log(`Generated: ${generated.length} SEO pages`);
}

async function main() {
  console.log('Fetching data from API...');
  const [emojis, categories, trending, pages] = await Promise.all([
    fetchJSON('/api/emojis'),
    fetchJSON('/api/emojis/categories'),
    fetchJSON('/api/emojis/trending'),
    fetchJSON('/api/pages'),
  ]);
  
  console.log(`Found ${emojis.length} emojis, ${categories.length} categories, ${pages.length} pages`);

  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  await generateHomePage(emojis, categories, trending, pages);
  await generateCategoryPages(emojis, categories, pages);
  await generateEmojiPages(emojis, pages);
  await generateSeoPages(emojis, pages);

  console.log('\nDone! Static site generated in: static-site/');
}

main().catch(console.error);
