# Stylesheet fixtures

`tailwind-app.css` was generated with `tailwindcss@4.3.5` and `@tailwindcss/cli@4.3.5`
from `julia-script/t3code` commit `0080084c7109b0c0e9dff2904674b2ce75f76f2a`, scanning
`apps/web/src`. The input is:

```css
@import "tailwindcss" source(none);
@source "<checkout>/apps/web/src";
```

`tailwind-small.css` uses the same Tailwind version and the `tailwind-page.html` sample
in SilkUI's `modules/tree/tests/fixtures/stylesheets`, with the dark variant defined as
`@custom-variant dark (&:where(.dark, .dark *));`.

`plain.css` exercises ordinary CSS: layers, nesting, custom properties, media queries,
combinators, attributes, `:has()`, and important declarations. No CSS processor is needed.

The compiler tests compile these files and decode their serialized form. Runtime rendering
and Chromium parity are separate integration checks in SilkUI.
