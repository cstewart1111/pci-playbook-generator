import { useState } from "react";
import { useSearch } from "wouter";
import {
  useListPlaybooks,
  useGenerateEmail,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
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
import { OutputBox } from "@/components/output-box";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { parseSearch } from "@/lib/query-params";

const PRODUCT_TYPES = [
  "Pipeline Discovery",
  "Oral History",
  "Census & Directory",
  "Storycause/DXO",
];

const schema = z.object({
  name: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  productType: z.string().optional(),
  problemHypothesis: z.string().optional(),
  recentHook: z.string().optional(),
  context: z.string().min(1, "Please provide at least some context to generate from"),
  playbookId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function GenerateEmail() {
  const search = useSearch();
  const defaultPlaybook = parseSearch(search).get("playbook") ?? "";

  const [output, setOutput] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<number | null>(null);
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
      context: "",
      playbookId: defaultPlaybook,
    },
  });

  const generateEmail = useGenerateEmail({
    mutation: {
      onSuccess: (data) => {
        setOutput(data.output);
        setGenerationId(data.generationId);
      },
      onError: () => {
        toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
      },
    },
  });

  const onSubmit = (values: FormValues) => {
    setOutput(null);
    setGenerationId(null);
    generateEmail.mutate({
      data: {
        name: values.name || "",
        company: values.company || "",
        role: values.role || "",
        productType: (values.productType && values.productType !== "none") ? values.productType : "",
        problemHypothesis: values.problemHypothesis || "",
        recentHook: values.recentHook || "",
        context: values.context,
        playbookId: (values.playbookId && values.playbookId !== "none") ? Number(values.playbookId) : null,
      },
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                          <Input placeholder="e.g. Acme Corp" data-testid="input-company" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Role <span className="text-xs">(optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. VP of Sales" data-testid="input-role" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="productType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Product Type <span className="text-xs">(optional)</span></FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product-type">
                              <SelectValue placeholder="Select a product type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No product type</SelectItem>
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
                  <FormField
                    control={form.control}
                    name="playbookId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Playbook <span className="text-xs">(optional)</span></FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-playbook">
                              <SelectValue placeholder="Use no playbook" />
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
                </div>

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
            data-testid="section-email-output"
          />
        )}
      </div>
    </div>
  );
}
