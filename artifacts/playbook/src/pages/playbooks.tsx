import { useState } from "react";
import { Link } from "wouter";
import {
  useListPlaybooks,
  useCreatePlaybook,
  useDeletePlaybook,
  getListPlaybooksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Trash2, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().min(1, "Description is required").max(500),
});

type CreateForm = z.infer<typeof createSchema>;

export default function Playbooks() {
  const { data: playbooks, isLoading } = useListPlaybooks();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", description: "" },
  });

  const createPlaybook = useCreatePlaybook({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlaybooksQueryKey() });
        setShowCreate(false);
        form.reset();
        toast({ title: "Playbook created" });
      },
      onError: () => {
        toast({ title: "Failed to create playbook", variant: "destructive" });
      },
    },
  });

  const deletePlaybook = useDeletePlaybook({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlaybooksQueryKey() });
        setDeleteId(null);
        toast({ title: "Playbook deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete playbook", variant: "destructive" });
      },
    },
  });

  const onSubmit = (values: CreateForm) => {
    createPlaybook.mutate({ data: values });
  };

  return (
    <div>
      <PageHeader
        title="Playbooks"
        description="Manage your winning email pattern libraries"
        actions={
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            data-testid="button-create-playbook"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Playbook
          </Button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !playbooks || playbooks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center" data-testid="text-empty-state">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No playbooks yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create a playbook and import winning emails to extract patterns.</p>
              <Button
                size="sm"
                className="mt-4"
                onClick={() => setShowCreate(true)}
                data-testid="button-create-first-playbook"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create your first playbook
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {playbooks.map((pb) => (
              <Card key={pb.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{pb.name}</p>
                      {pb.qualityScore != null && (
                        <span
                          data-testid={`badge-quality-${pb.id}`}
                          className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm shrink-0"
                        >
                          {pb.qualityScore}/10
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{pb.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pb.emailCount} emails · {formatDistanceToNow(new Date(pb.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        setDeleteId(pb.id);
                      }}
                      data-testid={`button-delete-playbook-${pb.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Link
                      href={`/playbooks/${pb.id}`}
                      data-testid={`link-playbook-${pb.id}`}
                      className="flex items-center justify-center h-7 w-7 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Playbook</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Enterprise Outbound Q1"
                        data-testid="input-playbook-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what makes these emails effective..."
                        rows={3}
                        data-testid="input-playbook-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowCreate(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPlaybook.isPending}
                  data-testid="button-submit-create-playbook"
                >
                  {createPlaybook.isPending ? "Creating..." : "Create Playbook"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Playbook?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the playbook and all its patterns. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deletePlaybook.mutate({ id: deleteId })}
              data-testid="button-confirm-delete"
            >
              {deletePlaybook.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
