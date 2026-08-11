# ``FlowingDayPreferences``

Compose application preferences from reusable rows, sections, pages, and a native AppKit window lifecycle.

## Overview

FlowingDayPreferences builds on `FlowingDayControls`. Your application defines page identity, state, persistence, and copy. The module provides navigation, content layout, presentation, accessibility, and a reusable Preferences window presenter.

Start with <doc:GettingStarted> and use `FlowingDayControls` directly for controls outside a Preferences window.

## Topics

### Essentials

- <doc:GettingStarted>
- ``PreferencesView``
- ``PreferencesViewConfiguration``
- ``PreferencesWindowPresenter``
- ``PreferencesWindowConfiguration``

### Structure

- ``PreferencesPage``
- ``PreferencesPageGroup``
- ``PreferencesPaneStack``
- ``PreferencesSection``
- ``PreferencesRow``

### Common Rows

- ``PreferencesSwitchRow``
- ``PreferencesSliderRow``
- ``PreferencesPopupRow``
- ``PreferencesSegmentedRow``
- ``PreferencesMultiSelectRow``
- ``PreferencesValueRow``
- ``PreferencesButtonRow``
