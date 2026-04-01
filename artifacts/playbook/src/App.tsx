import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Playbooks from "@/pages/playbooks";
import PlaybookDetail from "@/pages/playbook-detail";
import Import from "@/pages/import";
import GenerateEmail from "@/pages/generate-email";
import GenerateScript from "@/pages/generate-script";
import SuggestEdits from "@/pages/suggest-edits";
import HubSpotCompanies from "@/pages/hubspot-companies";
import HubSpotCompanyDetail from "@/pages/hubspot-company-detail";
import HubSpotContacts from "@/pages/hubspot-contacts";
import HubSpotContactDetail from "@/pages/hubspot-contact-detail";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/playbooks" component={Playbooks} />
        <Route path="/playbooks/:id" component={PlaybookDetail} />
        <Route path="/import" component={Import} />
        <Route path="/generate-email" component={GenerateEmail} />
        <Route path="/generate-script" component={GenerateScript} />
        <Route path="/suggest-edits" component={SuggestEdits} />
        <Route path="/hubspot/companies" component={HubSpotCompanies} />
        <Route path="/hubspot/companies/:id" component={HubSpotCompanyDetail} />
        <Route path="/hubspot/contacts" component={HubSpotContacts} />
        <Route path="/hubspot/contacts/:id" component={HubSpotContactDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
