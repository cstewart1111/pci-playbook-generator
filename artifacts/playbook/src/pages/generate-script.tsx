import { useState } from "react";
import {
  useListPlaybooks,
  useGenerateScript,
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
  objective: z.string().min(1, "Objective is required"),
  context: z.string().min(1, "Context is required"),
  playbookId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function GenerateScript() {
  const [output, setOutput] = useState<string | null>(null);
  const { toast } = useToast();
  const { data: playbooks } = useListPlaybooks();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      objective: "",
      context: "",
      playbookId: "",
    },
  });

  const generateScript = useGenerateScript({
    mutation: {
      onSuccess: (data) => {
        setOutput(data.output);
      },
      onError: () => {
        toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
      },
    },
  });

  const onSubmit = (values: FormValues) => {
    setOutput(null);
    generateScript.mutate({
      data: {
        objective: values.objective,
        context: values.context,
        playbookId: (values.playbookId && values.playbookId !== "none") ? Number(values.playbookId) : null,
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Script Generator"
        description="Generate a structured call script with talk tracks and objection handling"
      />

      <div className="p-6 space-y-5 max-w-3xl">
        <Card>
          <CardContent className="p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Call Objective</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. Book a discovery call to understand their current data pipeline challenges"
                          rows={3}
                          data-testid="input-objective"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="context"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prospect Context</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Who are you calling? What do you know about them? Any recent news?"
                          rows={3}
                          data-testid="input-context"
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
                      <FormLabel>Playbook (optional)</FormLabel>
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

                <Button
                  type="submit"
                  disabled={generateScript.isPending}
                  data-testid="button-generate-script"
                  className="w-full"
                >
                  {generateScript.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Script...
                    </>
                  ) : (
                    "Generate Script"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {output && (
          <OutputBox
            content={output}
            label="Generated Script"
            data-testid="section-script-output"
          />
        )}
      </div>
    </div>
  );
}
