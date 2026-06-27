import { createFileRoute } from "@tanstack/react-router";
import { UniverseExperience } from "@/components/UniverseExperience";

export const Route = createFileRoute("/star/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "A star in The Shriks Universe" },
      {
        name: "description",
        content: "A single star, placed by someone who found this universe.",
      },
      { property: "og:title", content: "A star in The Shriks Universe" },
      {
        property: "og:description",
        content: `Star ${params.id.slice(0, 8)} — open the universe at this point.`,
      },
    ],
  }),
  component: StarPage,
});

function StarPage() {
  const { id } = Route.useParams();
  return <UniverseExperience initialFocusId={id} />;
}
