import { createFileRoute } from "@tanstack/react-router";
import { UniverseExperience } from "@/components/UniverseExperience";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Shriks Universe — a living cosmology" },
      {
        name: "description",
        content:
          "A 3D universe built by the people who find it. Each visitor places a star. As the sky fills, nebulae form, galaxies emerge.",
      },
      { property: "og:title", content: "The Shriks Universe" },
      {
        property: "og:description",
        content: "Every visitor places a star. The universe grows in real time.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => <UniverseExperience initialFocusId={null} />,
});
