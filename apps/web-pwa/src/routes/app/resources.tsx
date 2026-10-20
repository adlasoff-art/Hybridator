import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/dashboard/ComingSoonPage";
import { STUB_PAGES } from "@/components/dashboard/stub-pages";

export const Route = createFileRoute("/app/resources")({
  component: () => <ComingSoonPage {...STUB_PAGES.resources!} />,
});
