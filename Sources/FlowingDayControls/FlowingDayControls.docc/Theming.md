# Theming Controls

Customize semantic values at the edge of a view hierarchy instead of styling each control separately.

## Use a named accent

Named accents derive their fill, foreground, wash, and veil roles from one source color in both appearances.

```swift
content
    .flowingAccent(.petal)
```

## Customize a semantic layer

``FlowingMetrics``, ``FlowingTypography``, and ``FlowingSurfaces`` contain reusable control semantics. Preferences-only window, navigation, and row values live in the `FlowingDayPreferences` module.

```swift
content
    .flowingMetrics(
        FlowingMetrics(
            controlRadius: 10,
            cardRadius: 16
        )
    )
```

Prefer subtree overrides for a deliberate local variation. A single environment value keeps descendants visually coherent and preserves the library's state, motion, and accessibility behavior.
