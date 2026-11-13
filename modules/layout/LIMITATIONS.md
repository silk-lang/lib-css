# Silk limitations

## 1. Template formatting inside a borrowed match

- Status: [silk-lang/silk#2390](https://github.com/silk-lang/silk/issues/2390), filed against published `0.1.0-dev.20+10a8c67813a1` on macOS arm64.
- Failure: `StderrWriter.print` inside a borrowed `Option<&Value>` match produces SEM0042 and an unsupported-construct diagnostic in `validatedTemplate`. Removing only the print statement makes the minimized package check successfully.
- Workaround: `layout-test-harness/src/protocol.silk` at the repository root, marked `LIMITATION-1`, writes field-error diagnostics through the standard `Writer` service. The compiler and stdlib remain unmodified.
- Cost: two field-diagnostic callers share the helper. Error-only path; no runtime performance penalty measured.
- Reproduction: self-contained package and exact diagnostics in the issue. Recheck on a toolchain upgrade before removing the workaround.

## 2. Managed task subprocesses on Windows

- Status: [silk-lang/silk#3034](https://github.com/silk-lang/silk/issues/3034), reported against `0.1.0-dev.72+9c780a04d6ef`.
- Native automation targets macOS and GNU/Linux, as the existing layout gate did. Browser CDP needs independent bidirectional descriptors 3 and 4; smoke, incremental and benchmark tasks need stdin, captured output, deadlines and child cleanup.
- `silk.system.subprocess` exports `Subprocess`, `SpawnOptions` and `Stdio` only on supported Darwin/GNU targets. Importing these names with `silk check --target x86_64-pc-windows-msvc` produces SEM0014. The blocking `ChildProcess` service closes stdin and cannot replace this protocol.
- Reproduction candidate: a package whose main imports those three names and calls `SpawnOptions.make()`, checked for `x86_64-pc-windows-msvc`. The task migration does not modify the compiler or substitute a shell/interpreter process bridge.
- Clean cutover: standalone Python/Node/shell automation has been removed. Managed-process tasks explicitly reject Windows until this capability exists; no interpreter runner or compatibility path remains. Specification/encoding maintenance and fixture-font generation do not require the managed-process API.
