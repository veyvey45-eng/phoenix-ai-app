import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Navigation } from "./components/Navigation";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import { CodeExecutorPage } from "./pages/CodeExecutorPage";
import WebPageGeneratorPage from "./pages/WebPageGenerator";
import { PhoenixShowcase } from "./pages/PhoenixShowcase";
import About from "./pages/About";
import { OfflineBanner } from "./components/ConnectionStatus";
import CryptoExpert from "./pages/CryptoExpert";
import Tools from "./pages/Tools";
import MCPBridge from "./pages/MCPBridge";
import AgentMode from "./pages/AgentMode";
import Workspace from "./pages/Workspace";
import MyProjects from "./pages/MyProjects";
import { CommandPalette } from "./components/CommandPalette";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/code-executor" component={CodeExecutorPage} />
      <Route path="/web-generator" component={WebPageGeneratorPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/showcase" component={PhoenixShowcase} />
      <Route path="/about" component={About} />
      <Route path="/crypto" component={CryptoExpert} />
      <Route path="/tools" component={Tools} />
      <Route path="/mcp-bridge" component={MCPBridge} />
      <Route path="/agent" component={AgentMode} />
      <Route path="/workspace" component={Workspace} />
      <Route path="/projects" component={MyProjects} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable={true}>
        <TooltipProvider>
          <Toaster />
          <OfflineBanner />
          <CommandPalette />
          <header role="banner">
            <Navigation />
          </header>
          <main role="main" aria-label="Contenu principal de Phoenix AI">
            <Router />
          </main>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
