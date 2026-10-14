PelotonHub — FULL VISUAL OVERHAUL version
==========================================
This is a from-scratch reskin — the entire css/styles.css was rewritten
with a bolder visual language, while every id/class/data-attribute your
JS depends on is 100% preserved (I only rewrote property values inside
each selector, never selector names/structure), so all functionality —
cart, auth, wishlist, reviews, orders, RSVP, filters, dynamic catalog
grid, modal, toast, etc. — works exactly as before.

New direction — "Kinetic":
- New color duo: flame coral (#ff4d23) + acid lime (#c6f92e) replace the
  single chartreuse accent, used in gradients on CTAs, progress bars,
  tags, and the featured membership tier.
- Rounded, shadowed, card-based layout instead of the flat bordered-grid
  look — generous corner radii, soft elevation shadows, and gap-based
  grids that lift on hover instead of shared hairline borders.
- Pill-shaped buttons, nav links, search bar, and status pills throughout.
- Bigger, gradient-clipped italic hero type with soft radial color blooms
  behind it.
- Dark stat bar and gradient member card for a bit more visual weight in
  the "editorial" sections.
- Same Fraunces / Inter / IBM Plex Mono type system as your original —
  only how it's used has changed, so no new fonts/HTML changes were
  needed beyond what refine already did.

It also includes the same two real fixes as the refine version (they're
genuine bugs, not stylistic choices):
1. The mobile hamburger menu now actually opens (".nav-links.open" was
   never styled in the original CSS).
2. The two hardcoded 2-column inline-style grids on support.html and
   home.html now collapse properly on mobile.

Files changed: css/styles.css (full rewrite), support.html, home.html.
Every other file is byte-identical to what you sent — no ids, classes,
or data-attributes were renamed or removed.

To use: unzip and open index.html (or serve the folder with any static
file server).
