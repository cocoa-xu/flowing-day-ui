# Accessibility

Provide product meaning while FlowingDayControls supplies platform behavior.

## Label every interaction

Controls that cannot infer a useful label require one in their initializer. Use concise labels that describe purpose, and provide a value formatter when a raw number would be ambiguous.

```swift
FlowingSlider(
    "Text size",
    value: $scale,
    in: 0.8...1.4,
    step: 0.1,
    formatValue: { "\(Int($0 * 100)) percent" }
)
```

## Preserve keyboard behavior

Selection controls support directional keyboard navigation and VoiceOver adjustment. Custom focus feedback replaces the default AppKit ring without removing the visible keyboard state. Avoid wrapping controls in gestures that consume their keyboard or accessibility actions.

## Respect user preferences

Built-in transitions respond to Reduce Motion. When composing your own content inside a control, apply the same rule to any additional movement and keep state changes understandable without animation.

Test the completed application with keyboard-only navigation, VoiceOver, Increase Contrast, Reduce Motion, and both left-to-right and right-to-left layouts. The library can provide mechanics, but only the application can verify that its labels and task flow carry the intended meaning.
