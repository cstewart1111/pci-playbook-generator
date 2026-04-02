import { useState } from "react";
import {
  useListPlaybooks,
  useSuggestEdits,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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

const schema = z.object({
  draftEmail: z.string().min(1, "Draft email is required"),
  playbookId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function SuggestEdits() {
  const [output, setOutput] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<number | null>(null);
  const { toast } = useToast();
  const { data: playbooks } = useListPlaybooks();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      draftEmail: "",
      playbookId: "",
    },
  });

  const suggestEdits = useSuggestEdits({
    mutation: {
      onSuccess: (data) => {
        setOutput(data.output);
        setGenerationId(data.generationId);
      },
      onError: () => {
        toast({ title: "Analysis failed", description: "Please try again.", variant: "destructive" });
      },
    },
  });

  const onSubmit = (values: FormValues) => {
    setOutput(null);
    setGenerationId(null);
    suggestEdits.mutate({
      data: {
        draftEmail: values.draftEmail,
        playbookId: (values.playbookId && values.playbookId !== "none") ? Number(values.playbookId) : null,
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Edit Coach"
        description="Paste a draft email and get AI-powered feedback to sharpen your message"
      />

      <div className="p-6 space-y-5 max-w-3xl">
        <Card>
          <CardContent className="p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="draftEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Draft Email</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Paste your draft email here (subject + body)..."
                          rows={10}
                          data-testid="input-draft-email"
                          className="font-mono text-xs resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="playbookId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Compare Against Playbook (optional)</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-playbook">
                            <SelectValue placeholder="No playbook (general feedback)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No playbook (general feedback)</SelectItem>
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

                <Button
                  type="submit"
                  disabled={suggestEdits.isPending}
                  data-testid="button-suggest-edits"
                  className="w-full"
                >
                  {suggestEdits.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing Draft...
                    </>
                  ) : (
                    "Get Edit Suggestions"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {output && (
          <OutputBox
            content={output}
            label="Edit Suggestions"
            generationId={generationId ?? undefined}
            data-testid="section-edits-output"
          />
        )}
      </div>
    </div>
  );
}
