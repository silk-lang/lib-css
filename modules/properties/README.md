# css-properties

CSS properties and their value types, in one place. `css-layout`, `css-style` and their clients
import these instead of defining their own.

## What it covers

- **Computed values** (`computed`): the typed values layout and paint read once the cascade has run
  and units are resolved. `Dimension` holds pixels and a percentage fraction (0.5 is 50%), `Edges`
  holds four of them, and each keyword property has its own enum (`Display`, `FlexDirection`,
  `Align`, `Overflow`, `Position` and the rest).

- **The property catalog** (`catalog`): one `Property` enum with each property's name, index,
  inheritance, initial value and shorthand expansion, taken from the pinned specifications.
  `css-style` re-exports it as `properties`. It lists the SVG and text properties today; the
  box properties (margin, padding, border, flex, grid and so on) are being added.
