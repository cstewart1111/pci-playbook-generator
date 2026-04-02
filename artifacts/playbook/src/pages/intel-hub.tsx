import { useState, useRef } from "react";
import { useSearch } from "wouter";
import {
  useListKnowledgeDocs,
  useCreateKnowledgeDoc,
  useDeleteKnowledgeDoc,
  useUploadKnowledgeDoc,
  useListPlaybooks,
  useAnalyzeEmails,
  getListKnowledgeDocsQueryKey,
  getGetPlaybookQueryKey,
  getListPlaybooksQueryKey,
} from "@workspace/api-client-react";
import type { AnalysisResult } from "@workspace/api-client-react";
import { parseSearch } from "@/lib/query-params";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Trash2,
  FileText,
  Shield,
  Target,
  BookOpen,
  MessageSquare,
  Plus,
  CheckCircle2,
  Upload,
  FileAudio,
  FileSpreadsheet,
  Presentation,
  Download,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ActiveTab = "knowledge" | "analyze";

const DOC_TYPES = [
  { value: "product_info", label: "Product Info / One-Pager", icon: FileText },
  { value: "case_study", label: "Case Study", icon: Target },
  { value: "battle_card", label: "Competitive Battle Card", icon: Shield },
  { value: "objection_handling", label: "Objection Handling / FAQ", icon: MessageSquare },
  { value: "industry_context", label: "Industry / Vertical Context", icon: BookOpen },
  { value: "voice_guidelines", label: "Tone & Voice Guidelines", icon: MessageSquare },
  { value: "other", label: "Other", icon: FileText },
];

const typeColors: Record<string, string> = {
  product_info: "bg-blue-100 text-blue-700",
  case_study: "bg-green-100 text-green-700",
  battle_card: "bg-red-100 text-red-700",
  objection_handling: "bg-orange-100 text-orange-700",
  industry_context: "bg-purple-100 text-purple-700",
  voice_guidelines: "bg-yellow-100 text-yellow-700",
  other: "bg-gray-100 text-gray-700",
};

const ACCEPTED_FILE_TYPES = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".webm",
].join(",");

const FILE_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "audio/mpeg": "Audio",
  "audio/wav": "Audio",
  "audio/ogg": "Audio",
  "audio/mp4": "Audio",
  "audio/webm": "Audio",
};

function getFileIcon(fileType: string) {
  if (fileType.startsWith("audio/")) return FileAudio;
  if (fileType.includes("spreadsheet") || fileType.includes("excel")) return FileSpreadsheet;
  if (fileType.includes("presentation") || fileType.includes("powerpoint")) return Presentation;
  return FileText;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const JOB_TITLE_GROUPS = [
  {
    label: "President / Executive",
    titles: ["President / CEO", "Executive Director", "Chancellor", "Provost"],
  },
  {
    label: "Vice President",
    titles: ["VP of Advancement", "VP of Development", "VP of Alumni Relations", "VP of Marketing", "VP of Enrollment", "VP of Communications"],
  },
  {
    label: "Director",
    titles: ["Director of Advancement", "Director of Development", "Director of Alumni Relations", "Director of Marketing", "Director of Communications", "Director of Enrollment", "Director of Operations", "Director of Annual Giving"],
  },
  {
    label: "Assistant / Associate Director",
    titles: ["Associate VP of Advancement", "Assistant Director of Advancement", "Assistant Director of Development", "Assistant Director of Alumni Relations", "Associate Director of Annual Giving"],
  },
  {
    label: "Military / VFW / American Legion",
    titles: ["Post Commander", "State Commander", "Department Commander", "District Commander", "National Officer", "Post Adjutant", "State Adjutant", "Department Adjutant", "Post Quartermaster", "Department Quartermaster", "Service Officer", "Membership Chair", "Department Membership Director", "Auxiliary President", "Post Chaplain"],
  },
  { label: "Other", titles: ["Other"] },
];

const EMAIL_TYPES = [
  { value: "cold_email", label: "Cold Email" },
  { value: "bda_email", label: "BDA Email" },
  { value: "ae_email", label: "AE Email" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "breakup", label: "Breakup" },
  { value: "other", label: "Other" },
];

export default function IntelHub() {
  const search = useSearch();
  const defaultPlaybook = parseSearch(search).get("playbook") ?? "";
  const defaultTab = parseSearch(search).get("tab");

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    defaultTab === "analyze" ? "analyze" : "knowledge"
  );

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Upload sales materials and analyze winning emails to train AI on your style"
      />

      <div className="p-6 space-y-5 max-w-4xl">
        {/* Tab Toggle */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === "knowledge" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("knowledge")}
          >
            Knowledge Documents
          </Button>
          <Button
            variant={activeTab === "analyze" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("analyze")}
          >
            Email Analyzer
          </Button>
        </div>

        {activeTab === "knowledge" ? (
          <KnowledgeTab />
        ) : (
          <AnalyzeTab defaultPlaybook={defaultPlaybook} />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Knowledge Documents Tab ───────────────────────── */

function KnowledgeTab() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("product_info");
  const [content, setContent] = useState("");
  const [playbookId, setPlaybookId] = useState<string>("global");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: docs, isLoading } = useListKnowledgeDocs();
  const { data: playbooks } = useListPlaybooks();

  const createDoc = useCreateKnowledgeDoc({
    mutation: {
      onSuccess: () => {
        toast({ title: "Knowledge added", description: "Document saved and will be used in future generations." });
        setTitle("");
        setContent("");
        queryClient.invalidateQueries({ queryKey: getListKnowledgeDocsQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
      },
    },
  });

  const uploadDoc = useUploadKnowledgeDoc({
    mutation: {
      onSuccess: () => {
        toast({ title: "File uploaded", description: "Document uploaded and saved to the knowledge base." });
        setTitle("");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        queryClient.invalidateQueries({ queryKey: getListKnowledgeDocsQueryKey() });
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : "Please try again.";
        toast({ title: "Upload failed", description: message, variant: "destructive" });
      },
    },
  });

  const deleteDoc = useDeleteKnowledgeDoc({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKnowledgeDocsQueryKey() });
        toast({ title: "Document removed" });
      },
    },
  });

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    createDoc.mutate({
      data: {
        title: title.trim(),
        type,
        content: content.trim(),
        playbookId: playbookId !== "global" ? Number(playbookId) : null,
      },
    });
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title.trim()) return;
    uploadDoc.mutate({
      data: {
        file: selectedFile,
        title: title.trim(),
        type,
        playbookId: playbookId !== "global" ? Number(playbookId) : null,
      },
    });
  };

  const handleFileSelect = (file: File) => {
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Maximum file size is 25 MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const isPending = createDoc.isPending || uploadDoc.isPending;

  return (
    <>
      {/* Add Document Form */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-semibold">Add Knowledge Document</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <form onSubmit={selectedFile ? handleFileUpload : handleTextSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Title</label>
                <Input
                  placeholder="e.g. PCI Q1 2026 Product Overview"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-knowledge-title"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Document Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger data-testid="select-knowledge-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>
                        {dt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Playbook <span className="text-xs">(optional - leave as Global for all playbooks)</span>
              </label>
              <Select value={playbookId} onValueChange={setPlaybookId}>
                <SelectTrigger data-testid="select-knowledge-playbook">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (all playbooks)</SelectItem>
                  {playbooks?.map((pb) => (
                    <SelectItem key={pb.id} value={String(pb.id)}>
                      {pb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload Area */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Upload File</label>
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : selectedFile
                      ? "border-green-300 bg-green-50"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="file-upload-area"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  data-testid="input-file-upload"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)} &middot;{" "}
                        {FILE_TYPE_LABELS[selectedFile.type] || selectedFile.type}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Drag & drop a file here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, Word, Excel, PowerPoint, or Audio (max 25 MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Text Content (hidden when file is selected) */}
            {!selectedFile && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  placeholder="Paste your product overview, case study, battle card, objection handling guide, or any other content that should inform AI-generated emails and scripts..."
                  rows={10}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  data-testid="input-knowledge-content"
                />
                <p className="text-xs text-muted-foreground">
                  This content will be injected into AI prompts when generating emails and scripts. Include specific facts, metrics, customer names, and differentiators.
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending || !title.trim() || (!selectedFile && !content.trim())}
              data-testid="button-save-knowledge"
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {selectedFile ? "Uploading..." : "Saving..."}
                </>
              ) : selectedFile ? (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File to Knowledge Base
                </>
              ) : (
                "Save to Knowledge Base"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Document List */}
      <div>
        <h3 className="text-sm font-semibold mb-3">
          Knowledge Documents ({docs?.length ?? 0})
        </h3>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : docs && docs.length > 0 ? (
          <div className="space-y-3">
            {docs.map((doc) => {
              const typeInfo = DOC_TYPES.find((dt) => dt.value === doc.type);
              const isFile = !!doc.fileName;
              const FileIcon = doc.fileType ? getFileIcon(doc.fileType) : FileText;
              return (
                <Card key={doc.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isFile && <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
                          <h4 className="text-sm font-semibold truncate">{doc.title}</h4>
                          <Badge
                            variant="secondary"
                            className={`text-xs shrink-0 ${typeColors[doc.type] ?? ""}`}
                          >
                            {typeInfo?.label ?? doc.type}
                          </Badge>
                          {isFile && doc.fileType && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {FILE_TYPE_LABELS[doc.fileType] || "File"}
                            </Badge>
                          )}
                          {doc.playbookId ? (
                            <Badge variant="outline" className="text-xs shrink-0">
                              Playbook #{doc.playbookId}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs shrink-0">
                              Global
                            </Badge>
                          )}
                        </div>
                        {isFile ? (
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">
                              {doc.fileName} &middot; {doc.fileSize ? formatFileSize(doc.fileSize) : ""}
                            </p>
                            <a
                              href={`/api/knowledge/${doc.id}/download`}
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {doc.content.slice(0, 200)}...
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Added {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteDoc.mutate({ id: doc.id })}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        data-testid={`button-delete-knowledge-${doc.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No knowledge documents yet. Add product info, case studies, and battle cards to make your AI generations smarter.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

/* ───────────────────────── Email Analyzer Tab ───────────────────────── */

interface EmailEntry {
  name: string;
  jobTitle: string;
  emailType: string;
  content: string;
}

function AnalyzeTab({ defaultPlaybook }: { defaultPlaybook: string }) {
  const [emails, setEmails] = useState<EmailEntry[]>([{ name: "", jobTitle: "", emailType: "cold_email", content: "" }]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<string>(defaultPlaybook);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: playbooks } = useListPlaybooks();
  const analyzeEmails = useAnalyzeEmails({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        queryClient.invalidateQueries({ queryKey: getListPlaybooksQueryKey() });
        if (selectedPlaybook) {
          queryClient.invalidateQueries({ queryKey: getGetPlaybookQueryKey(Number(selectedPlaybook)) });
        }
        toast({ title: "Analysis complete", description: `Extracted ${data.patterns.length} patterns` });
      },
      onError: () => {
        toast({ title: "Analysis failed", description: "Check that your emails are pasted correctly.", variant: "destructive" });
      },
    },
  });

  const addEmail = () => setEmails((prev) => [...prev, { name: "", jobTitle: "", emailType: "cold_email", content: "" }]);
  const removeEmail = (i: number) => setEmails((prev) => prev.filter((_, idx) => idx !== i));
  const updateEmail = (i: number, field: keyof EmailEntry, val: string) =>
    setEmails((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));

  const handleAnalyze = () => {
    if (!selectedPlaybook) {
      toast({ title: "Select a playbook first", variant: "destructive" });
      return;
    }
    const filled = emails.filter((e) => e.content.trim());
    if (filled.length === 0) {
      toast({ title: "Paste at least one email", variant: "destructive" });
      return;
    }
    setResult(null);
    const emailStrings = filled.map((e) => {
      const meta = [
        e.name.trim() ? `From: ${e.name.trim()}` : "",
        e.jobTitle.trim() ? `Job Title: ${e.jobTitle.trim()}` : "",
        e.emailType ? `Type: ${EMAIL_TYPES.find((t) => t.value === e.emailType)?.label ?? e.emailType}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      return meta ? `[${meta}]\n${e.content.trim()}` : e.content.trim();
    });
    analyzeEmails.mutate({ id: Number(selectedPlaybook), data: { emails: emailStrings } });
  };

  return (
    <>
      {/* Playbook selector */}
      <div className="space-y-1.5">
        <Label htmlFor="select-playbook">Target Playbook</Label>
        <Select value={selectedPlaybook} onValueChange={setSelectedPlaybook}>
          <SelectTrigger id="select-playbook" data-testid="select-playbook" className="max-w-sm">
            <SelectValue placeholder="Select a playbook..." />
          </SelectTrigger>
          <SelectContent>
            {playbooks?.map((pb) => (
              <SelectItem key={pb.id} value={String(pb.id)} data-testid={`option-playbook-${pb.id}`}>
                {pb.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(!playbooks || playbooks.length === 0) && (
          <p className="text-xs text-muted-foreground">No playbooks yet -- create one on the Playbooks page first.</p>
        )}
      </div>

      {/* Email inputs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Emails to analyze ({emails.filter((e) => e.content.trim()).length} filled)</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={addEmail}
            data-testid="button-add-email"
            className="h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Email
          </Button>
        </div>
        {emails.map((email, i) => (
          <Card key={i} className="relative">
            <CardContent className="p-4 space-y-3">
              {emails.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeEmail(i)}
                  data-testid={`button-remove-email-${i}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <Input
                    value={email.name}
                    onChange={(e) => updateEmail(i, "name", e.target.value)}
                    placeholder="Sender name"
                    data-testid={`input-email-name-${i}`}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Job Title</label>
                  <Select value={email.jobTitle} onValueChange={(val) => updateEmail(i, "jobTitle", val)}>
                    <SelectTrigger data-testid={`select-email-job-title-${i}`} className="text-sm">
                      <SelectValue placeholder="Select job title..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {JOB_TITLE_GROUPS.map((group) => (
                        <SelectGroup key={group.label}>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 pt-2">
                            {group.label}
                          </SelectLabel>
                          {group.titles.map((title) => (
                            <SelectItem key={title} value={title}>
                              {title}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Email Type</label>
                  <Select value={email.emailType} onValueChange={(val) => updateEmail(i, "emailType", val)}>
                    <SelectTrigger data-testid={`select-email-type-${i}`} className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMAIL_TYPES.map((et) => (
                        <SelectItem key={et.value} value={et.value}>
                          {et.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                value={email.content}
                onChange={(e) => updateEmail(i, "content", e.target.value)}
                placeholder={`Paste email #${i + 1} here (subject + body)...`}
                rows={5}
                data-testid={`input-email-${i}`}
                className="font-mono text-xs resize-y"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={handleAnalyze}
        disabled={analyzeEmails.isPending}
        data-testid="button-analyze"
        className="w-full sm:w-auto"
      >
        {analyzeEmails.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Analyzing with AI...
          </>
        ) : (
          "Analyze Emails"
        )}
      </Button>

      {/* Results */}
      {result && (
        <Card className="border-primary/30">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Analysis Complete
              <Badge variant="secondary" className="ml-auto text-xs">
                Score: {result.qualityScore}/10
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4" data-testid="section-analysis-results">
            {result.principles.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Principles</p>
                <ul className="space-y-1">
                  {result.principles.map((p, i) => (
                    <li key={i} data-testid={`text-result-principle-${i}`} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-0.5">&#10003;</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.patterns.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Patterns Extracted ({result.patterns.length})
                </p>
                <div className="space-y-2">
                  {result.patterns.map((pattern, i) => (
                    <div key={i} data-testid={`card-result-pattern-${i}`} className="border border-border rounded-sm p-2.5">
                      <Badge variant="outline" className="text-xs capitalize mb-1">{pattern.type}</Badge>
                      <p className="text-sm text-foreground">{pattern.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
