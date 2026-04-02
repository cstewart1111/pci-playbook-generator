import { useState } from "react";
import { useSearch } from "wouter";
import {
  useListPlaybooks,
  useGenerateEmail,
  type GenerateEmailBody,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { OutputBox, type SocialProofMeta } from "@/components/output-box";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, MessageCircle, Zap, Heart, Clock } from "lucide-react";
import { parseSearch } from "@/lib/query-params";

const TONES = [
  { value: "professional", label: "Professional", icon: Briefcase, description: "Polished & formal" },
  { value: "conversational", label: "Conversational", icon: MessageCircle, description: "Warm & friendly" },
  { value: "bold", label: "Bold", icon: Zap, description: "Direct & confident" },
  { value: "empathetic", label: "Empathetic", icon: Heart, description: "Understanding & human" },
  { value: "urgent", label: "Urgent", icon: Clock, description: "Timely & action-driven" },
] as const;

const PRODUCT_TYPES = [
  "Pipeline Discovery",
  "Oral History",
  "Census & Directory",
  "Storycause/DXO",
];

const JOB_TITLE_GROUPS = [
  {
    label: "President / Executive",
    titles: ["President / CEO", "Executive Director", "Chancellor", "Provost"],
  },
  {
    label: "Vice President",
    titles: [
      "VP of Advancement",
      "VP of Development",
      "VP of Alumni Relations",
      "VP of Marketing",
      "VP of Enrollment",
      "VP of Communications",
    ],
  },
  {
    label: "Director",
    titles: [
      "Director of Advancement",
      "Director of Development",
      "Director of Alumni Relations",
      "Director of Marketing",
      "Director of Communications",
      "Director of Enrollment",
      "Director of Operations",
      "Director of Annual Giving",
    ],
  },
  {
    label: "Assistant / Associate Director",
    titles: [
      "Associate VP of Advancement",
      "Assistant Director of Advancement",
      "Assistant Director of Development",
      "Assistant Director of Alumni Relations",
      "Associate Director of Annual Giving",
    ],
  },
  {
    label: "Military / VFW / American Legion",
    titles: [
      "Post Commander",
      "State Commander",
      "Department Commander",
      "District Commander",
      "National Officer",
      "Post Adjutant",
      "State Adjutant",
      "Department Adjutant",
      "Post Quartermaster",
      "Department Quartermaster",
      "Service Officer",
      "Membership Chair",
      "Department Membership Director",
      "Auxiliary President",
      "Post Chaplain",
    ],
  },
  {
    label: "Other",
    titles: ["Other"],
  },
];

const schema = z.object({
  name: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  productType: z.string().optional(),
  problemHypothesis: z.string().optional(),
  recentHook: z.string().optional(),
  tone: z.string().optional(),
  context: z.string().min(1, "Please provide at least some context to generate from"),
  playbookId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function GenerateEmail() {
  const search = useSearch();
  const defaultPlaybook = parseSearch(search).get("playbook") ?? "";

  const [output, setOutput] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [socialProof, setSocialProof] = useState<SocialProofMeta | null>(null);
  const [skipProofOnNext, setSkipProofOnNext] = useState(false);
  const { toast } = useToast();
  const { data: playbooks } = useListPlaybooks();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      company: "",
      role: "",
      productType: "",
      problemHypothesis: "",
      recentHook: "",
      tone: "",
      context: "",
      playbookId: defaultPlaybook,
    },
  });

  const generateEmail = useGenerateEmail({
    mutation: {
      onSuccess: (data: any) => {
        setOutput(data.output);
        setGenerationId(data.generationId);
        setSocialProof(data.socialProof || null);
        setSkipProofOnNext(false);
      },
      onError: () => {
        toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
        setSkipProofOnNext(false);
      },
    },
  });

  const onSubmit = (values: FormValues) => {
    setOutput(null);
    setGenerationId(null);
    setSocialProof(null);
    generateEmail.mutate({
      data: {
        name: values.name || "",
        company: values.company || "",
        role: (values.role && values.role !== "none") ? values.role : "",
        productType: (values.productType && values.productType !== "none") ? values.productType : "",
        problemHypothesis: values.problemHypothesis || "",
        recentHook: values.recentHook || "",
        tone: (values.tone && values.tone !== "") ? values.tone as GenerateEmailBody["tone"] : undefined,
        context: values.context,
        playbookId: (values.playbookId && values.playbookId !== "none") ? Number(values.playbookId) : null,
        ...(skipProofOnNext ? { skipSocialProof: true } : {}),
      } as any,
    });
  };

  return (
    <div>
      <PageHeader
        title="Email Writer"
        description="Generate a personalized outreach email for your prospect"
      />

      <div className="p-6 space-y-5 max-w-3xl">
        <Card>
          <CardContent className="p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Row 1: Name + Company */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Name <span className="text-xs">(optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. John Smith" data-testid="input-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Company <span className="text-xs">(optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. University of Texas" data-testid="input-company" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Row 2: Job Title + Product Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Job Title <span className="text-xs">(optional)</span></FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue placeholder="Select job title..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            <SelectItem value="none">Not specified</SelectItem>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="productType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Product Type <span className="text-xs">(optional)</span></FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product-type">
                              <SelectValue placeholder="Select a product..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Not specified</SelectItem>
                            {PRODUCT_TYPES.map((pt) => (
                              <SelectItem key={pt} value={pt}>
                                {pt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Row 3: Playbook */}
                <FormField
                  control={form.control}
                  name="playbookId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Playbook <span className="text-xs">(optional)</span></FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-playbook">
                            <SelectValue placeholder="No playbook" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No playbook</SelectItem>
                          {playbooks?.map((pb) => (
                            <SelectItem key={pb.id} value={String(pb.id)} data-testid={`option-playbook-${pb.id}`}>
                              {pb.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="problemHypothesis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Problem Hypothesis <span className="text-xs">(optional)</span></FormLabel>
                        <FormControl>
                          <Input
                            placeholder="What problem are they facing?"
                            data-testid="input-problem"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recentHook"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Recent Hook <span className="text-xs">(optional)</span></FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Saw your Series B announcement"
                            data-testid="input-hook"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Tone <span className="text-xs">(optional)</span></FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {TONES.map((t) => {
                          const Icon = t.icon;
                          const isSelected = field.value === t.value;
                          return (
                            <button
                              key={t.value}
                              type="button"
                              data-testid={`tone-${t.value}`}
                              onClick={() => field.onChange(isSelected ? "" : t.value)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground"
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                      {field.value && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {TONES.find((t) => t.value === field.value)?.description}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="context"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Context</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what you know about the prospect, what you want to accomplish, the tone you want, or any other details that should shape the email..."
                          rows={6}
                          data-testid="input-context"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={generateEmail.isPending}
                  data-testid="button-generate-email"
                  className="w-full"
                >
                  {generateEmail.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Email...
                    </>
                  ) : (
                    "Generate Email"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {output && (
          <OutputBox
            content={output}
            label="Generated Email"
            generationId={generationId ?? undefined}
            socialProof={socialProof}
            onSwapProof={() => {
              setSkipProofOnNext(false);
              form.handleSubmit(onSubmit)();
            }}
            onRegenerateWithoutProof={() => {
              setSkipProofOnNext(true);
              setTimeout(() => form.handleSubmit(onSubmit)(), 0);
            }}
            data-testid="section-email-output"
          />
        )}
      </div>
    </div>
  );
}
