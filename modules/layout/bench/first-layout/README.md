# First layout of long documents

Times the first full layout of three generated documents, each into a new
`LayoutTree` with nothing kept from an earlier compute:

- `chat`: a transcript of 1,000 messages. Flex rows and columns of wrapped
  paragraphs, lists, code blocks and 4-column grid tables.
- `grids`: 2,000 small grid tables of a fixed 4-column template.
- `nested`: 100 chains of flex containers nested 32 deep.

Text is measured by a stub of a fixed advance per byte (`provider.silk`), so
the times hold no shaping: they are the layout engine's own.

```sh
silk build -p css-layout-first-bench --release
build/<target>/release/css-layout-first-bench [--runs 9] [--document chat|grids|nested] [--size N]
```

For each document it prints:

- the median and fastest time of `--runs` first layouts;
- that time by phase. One more run is timed through `Measure`'s trace hooks,
  each part outside the parts nested in it, and scaled to the median, since
  reading the clock at every span slows that run;
- the time of text (probes, line fitting and emission) per line;
- size probes: the engine's counters, and a census of the probe cache: how
  often each box was looked up, how many probes were computed for it and
  under which width and height constraints, and how many of those another
  probe of the same box already answered. Probes answered without the
  cache (a childless box, a kept plain width) are in `size probes` only;
- what one more run asked of the allocator: requests, bytes requested, bytes
  the heap holds afterwards, and their difference, the transient bytes. The
  counting allocator reports no growth in place, so a list that doubles
  counts every copy;
- the fragment digest (`fragmentDigest`), which covers the geometry of every
  fragment. A change that is meant to keep the output must keep it.

Times vary by several percent between runs on a shared machine; compare
instruction counts (`valgrind --tool=callgrind` on a smaller `--size`) to
decide whether a change wins.
