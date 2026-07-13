export function load({ params }) {
  return {
    slug: params.slug,
    seo: {
      title: `${params.slug} — Team Details — Lightkeepers`,
      description:
        "Team investment levels — constellations, weapons, and artifacts from gcsim simulations.",
    },
  };
}
