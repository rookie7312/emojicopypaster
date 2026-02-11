import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Loader2, CheckCircle, XCircle, Zap, Pencil, Eye, Save, X, FileText, Settings, Upload, Plus, ListPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EmojiPage } from "@shared/schema";

type Tab = "generator" | "pages" | "keywords";

export default function Admin() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("generator");
  const [generatedCount, setGeneratedCount] = useState(0);
  const [isRunningBulk, setIsRunningBulk] = useState(false);
  const [editingPage, setEditingPage] = useState<EmojiPage | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMeta, setEditMeta] = useState("");
  const [editContent, setEditContent] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [singleKeyword, setSingleKeyword] = useState("");
  const [bulkKeywords, setBulkKeywords] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: pages = [] } = useQuery<EmojiPage[]>({
    queryKey: ["/api/pages"],
  });

  const generateMutation = useMutation({
    mutationFn: async (keyword: string) => {
      const res = await apiRequest("POST", "/api/pages/generate", { keyword });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, title, metaDescription, content }: { id: number; title: string; metaDescription: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/pages/${id}`, { title, metaDescription, content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      setEditingPage(null);
      toast({ title: "Page saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "Page deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete page", variant: "destructive" });
    },
  });

  const deleteAllPagesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/pages/all");
      return res.json();
    },
    onSuccess: (data: { deleted: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: `Deleted ${data.deleted} pages` });
    },
    onError: () => {
      toast({ title: "Failed to delete all pages", variant: "destructive" });
    },
  });

  const addKeywordsMutation = useMutation({
    mutationFn: async (keywords: string[]) => {
      const res = await apiRequest("POST", "/api/pages/add-keywords", { keywords });
      return res.json();
    },
    onSuccess: (data: { added: number; skipped: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: `Added ${data.added} keywords${data.skipped > 0 ? ` (${data.skipped} duplicates skipped)` : ''}` });
      setSingleKeyword("");
      setBulkKeywords("");
    },
    onError: () => {
      toast({ title: "Failed to add keywords", variant: "destructive" });
    },
  });

  const handleAddSingleKeyword = () => {
    const kw = singleKeyword.trim();
    if (!kw) return;
    addKeywordsMutation.mutate([kw]);
  };

  const handleAddBulkKeywords = () => {
    const keywords = bulkKeywords
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    if (keywords.length === 0) return;
    addKeywordsMutation.mutate(keywords);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      let keywords: string[];
      if (file.name.endsWith('.csv')) {
        keywords = text.split(/[,\n]/).map(k => k.trim().replace(/^["']|["']$/g, '')).filter(k => k.length > 0);
      } else {
        keywords = text.split('\n').map(k => k.trim()).filter(k => k.length > 0);
      }
      if (keywords.length === 0) {
        toast({ title: "No keywords found in file", variant: "destructive" });
        return;
      }
      addKeywordsMutation.mutate(keywords);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleBulkGenerate = async () => {
    setIsRunningBulk(true);
    setGeneratedCount(0);
    let total = 0;
    const maxRounds = 100;

    for (let i = 0; i < maxRounds; i++) {
      try {
        const res = await apiRequest("POST", "/api/pages/generate-batch");
        const data = await res.json();
        if (data.generated === 0) break;
        total += data.generated;
        setGeneratedCount(total);
        queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      } catch {
        toast({ title: "Batch generation error", variant: "destructive" });
        break;
      }
    }

    setIsRunningBulk(false);
    toast({ title: `Generated content for ${total} pages` });
    queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
  };

  const openEditor = (page: EmojiPage) => {
    setEditingPage(page);
    setEditTitle(page.title);
    setEditMeta(page.metaDescription || "");
    setEditContent(page.content || "");
  };

  const handleSave = () => {
    if (!editingPage) return;
    saveMutation.mutate({
      id: editingPage.id,
      title: editTitle,
      metaDescription: editMeta,
      content: editContent,
    });
  };

  const generatedPages = pages.filter(p => p.isGenerated);
  const ungeneratedPages = pages.filter(p => !p.isGenerated);

  const filteredGenerated = searchFilter
    ? generatedPages.filter(p =>
        p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.keyword.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : generatedPages;

  if (editingPage) {
    return (
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>Edit Page | Admin | EmojiCopyPaster</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <header className="border-b border-border">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setEditingPage(null)} data-testid="button-cancel-edit">
                <X className="w-4 h-4" />
              </Button>
              <h1 className="text-lg font-bold" data-testid="text-edit-title">Editing: {editingPage.keyword}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/page/${editingPage.slug}`}>
                <Button variant="outline" size="sm" data-testid="button-preview">
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
              </Link>
              <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save">
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <div>
            <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Page Title</label>
            <Input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              data-testid="input-edit-title"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Meta Description</label>
            <Input
              value={editMeta}
              onChange={e => setEditMeta(e.target.value)}
              data-testid="input-edit-meta"
            />
            <p className="text-xs text-muted-foreground mt-1">{editMeta.length}/155 characters</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
              Content (Markdown)
            </label>
            <Textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="min-h-[500px] font-mono text-sm"
              data-testid="textarea-edit-content"
            />
            <p className="text-xs text-muted-foreground mt-1">{editContent.length} characters</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Admin - Page Generator | EmojiCopyPaster</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold" data-testid="text-admin-title">Admin</h1>
        </div>
      </header>

      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 flex gap-0">
          <button
            onClick={() => setActiveTab("generator")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "generator"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-generator"
          >
            <Settings className="w-4 h-4" />
            Generator
          </button>
          <button
            onClick={() => setActiveTab("keywords")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "keywords"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-keywords"
          >
            <ListPlus className="w-4 h-4" />
            Add Keywords
          </button>
          <button
            onClick={() => setActiveTab("pages")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "pages"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-pages"
          >
            <FileText className="w-4 h-4" />
            Generated Pages
            {generatedPages.length > 0 && (
              <Badge variant="secondary" className="ml-1">{generatedPages.length}</Badge>
            )}
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === "generator" && (
          <>
            <Card className="p-6 mb-8">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold mb-1" data-testid="text-stats-title">Page Statistics</h2>
                  <p className="text-muted-foreground text-sm">
                    {generatedPages.length} generated / {pages.length} total pages
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="secondary" data-testid="badge-pending">
                    {ungeneratedPages.length} pending
                  </Badge>
                  <Badge data-testid="badge-done">
                    {generatedPages.length} done
                  </Badge>
                </div>
              </div>

              <div className="w-full bg-muted rounded-full h-2 mt-4 mb-6">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${pages.length > 0 ? (generatedPages.length / pages.length) * 100 : 0}%` }}
                  data-testid="progress-bar"
                />
              </div>

              <Button
                onClick={handleBulkGenerate}
                disabled={isRunningBulk || ungeneratedPages.length === 0}
                className="w-full"
                data-testid="button-bulk-generate"
              >
                {isRunningBulk ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Generating... ({generatedCount} done so far)
                  </>
                ) : ungeneratedPages.length === 0 ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    All pages generated
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Generate All ({ungeneratedPages.length} remaining)
                  </>
                )}
              </Button>
            </Card>

            {ungeneratedPages.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4" data-testid="text-pending-title">
                  Pending Pages ({ungeneratedPages.length})
                </h2>
                <div className="grid gap-2">
                  {ungeneratedPages.map(page => (
                    <Card key={page.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate" data-testid={`text-page-keyword-${page.id}`}>
                          {page.keyword}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateMutation.mutate(page.keyword)}
                        disabled={generateMutation.isPending}
                        data-testid={`button-generate-${page.id}`}
                      >
                        {generateMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Generate"
                        )}
                      </Button>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === "keywords" && (
          <>
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-1" data-testid="text-single-keyword-title">Add a Single Keyword</h2>
              <p className="text-sm text-muted-foreground mb-4">Type a keyword and add it as a new SEO page.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. happy face emoji"
                  value={singleKeyword}
                  onChange={e => setSingleKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSingleKeyword()}
                  data-testid="input-single-keyword"
                />
                <Button
                  onClick={handleAddSingleKeyword}
                  disabled={addKeywordsMutation.isPending || !singleKeyword.trim()}
                  data-testid="button-add-single-keyword"
                >
                  {addKeywordsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Plus className="w-4 h-4 mr-1" />
                  )}
                  Add
                </Button>
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-1" data-testid="text-bulk-keywords-title">Add Multiple Keywords</h2>
              <p className="text-sm text-muted-foreground mb-4">Enter one keyword per line. Duplicates will be skipped automatically.</p>
              <Textarea
                placeholder={"happy emoji\nsad emoji\nlove emoji\nfire emoji\nthumbs up emoji"}
                value={bulkKeywords}
                onChange={e => setBulkKeywords(e.target.value)}
                className="min-h-[200px] font-mono text-sm mb-4"
                data-testid="textarea-bulk-keywords"
              />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  {bulkKeywords.split('\n').filter(k => k.trim()).length} keywords entered
                </p>
                <Button
                  onClick={handleAddBulkKeywords}
                  disabled={addKeywordsMutation.isPending || !bulkKeywords.trim()}
                  data-testid="button-add-bulk-keywords"
                >
                  {addKeywordsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <ListPlus className="w-4 h-4 mr-1" />
                  )}
                  Add All Keywords
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-1" data-testid="text-upload-title">Upload Keywords File</h2>
              <p className="text-sm text-muted-foreground mb-4">Upload a .txt or .csv file with one keyword per line.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-file-upload"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={addKeywordsMutation.isPending}
                className="w-full"
                data-testid="button-upload-file"
              >
                {addKeywordsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Choose File to Upload
              </Button>
            </Card>
          </>
        )}

        {activeTab === "pages" && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Input
                  placeholder="Search generated pages..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="flex-1"
                  data-testid="input-search-pages"
                />
                {pages.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete ALL ${pages.length} pages? This cannot be undone.`)) {
                        deleteAllPagesMutation.mutate();
                      }
                    }}
                    disabled={deleteAllPagesMutation.isPending}
                    data-testid="button-delete-all-pages"
                  >
                    {deleteAllPagesMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-1" />
                    )}
                    Delete All
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Showing {filteredGenerated.length} of {generatedPages.length} generated pages
              </p>
            </div>

            {filteredGenerated.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-2" data-testid="text-no-pages">
                  {generatedPages.length === 0
                    ? "No pages generated yet. Go to the Generator tab and click Generate All."
                    : "No pages match your search."}
                </p>
                {generatedPages.length === 0 && (
                  <Button variant="outline" onClick={() => setActiveTab("generator")} data-testid="button-go-generator">
                    Go to Generator
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid gap-2">
                {filteredGenerated.map(page => (
                  <Card key={page.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium truncate" data-testid={`text-page-title-${page.id}`}>
                          {page.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 truncate" data-testid={`text-page-meta-${page.id}`}>
                          {page.metaDescription}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary">{page.keyword}</Badge>
                          <span className="text-xs text-muted-foreground">/page/{page.slug}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/page/${page.slug}`}>
                          <Button size="sm" variant="ghost" data-testid={`button-view-${page.id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Button size="sm" variant="outline" onClick={() => openEditor(page)} data-testid={`button-edit-${page.id}`}>
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Delete "${page.keyword}"?`)) {
                              deletePageMutation.mutate(page.id);
                            }
                          }}
                          disabled={deletePageMutation.isPending}
                          data-testid={`button-delete-${page.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
