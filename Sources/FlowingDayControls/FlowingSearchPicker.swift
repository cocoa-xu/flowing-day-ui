import SwiftUI

enum FlowingOptionSearch {
  static func matches(_ label: String, query: String) -> Bool {
    let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
    return query.isEmpty || label.localizedCaseInsensitiveContains(query)
  }
}

public struct FlowingSearchPicker<Value: Hashable>: View {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingStrings) private var strings
  @Environment(\.flowingTypography) private var typography
  @FocusState private var isSearchFocused: Bool
  @State private var localQuery = ""
  @Binding private var selection: Value
  private let label: String
  private let maximumVisibleOptions: Int
  private let options: [FlowingSelectOption<Value>]
  private let externalQuery: Binding<String>?
  private let onSelect: ((Value) -> Void)?

  public init(
    label: String,
    selection: Binding<Value>,
    options: [FlowingSelectOption<Value>],
    query: Binding<String>? = nil,
    maximumVisibleOptions: Int = 6,
    onSelect: ((Value) -> Void)? = nil
  ) {
    precondition(Set(options.map(\.id)).count == options.count)
    self.label = label
    _selection = selection
    self.options = options
    externalQuery = query
    self.maximumVisibleOptions = max(maximumVisibleOptions, 1)
    self.onSelect = onSelect
  }

  public var body: some View {
    VStack(spacing: 8) {
      searchField
      optionList
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(label)
  }

  private var query: Binding<String> {
    externalQuery ?? $localQuery
  }

  private var filteredOptions: [FlowingSelectOption<Value>] {
    options.filter { FlowingOptionSearch.matches($0.label, query: query.wrappedValue) }
  }

  private var searchField: some View {
    FlowingTextField(
      label,
      text: query,
      placeholder: strings.search,
      systemImage: "magnifyingglass",
      emphasis: .accented
    )
    .focused($isSearchFocused)
    .overlay {
      FlowingFocusDismissalBoundary(
        isFocused: Binding(
          get: { isSearchFocused },
          set: { isSearchFocused = $0 }
        )
      )
    }
  }

  @ViewBuilder
  private var optionList: some View {
    if filteredOptions.isEmpty {
      Text(strings.noResults)
        .font(typography.value.font)
        .foregroundStyle(FlowingPalette.faint)
        .frame(maxWidth: .infinity, minHeight: 36)
    } else {
      ScrollViewReader { proxy in
        ScrollView {
          LazyVStack(spacing: 4) {
            ForEach(filteredOptions) { option in
              optionButton(option)
                .id(option.id)
            }
          }
        }
        .scrollIndicators(.automatic)
        .frame(height: optionListHeight)
        .onAppear {
          proxy.scrollTo(selection, anchor: .center)
        }
      }
    }
  }

  private var optionListHeight: CGFloat {
    CGFloat(min(filteredOptions.count, maximumVisibleOptions)) * 34
  }

  private func optionButton(_ option: FlowingSelectOption<Value>) -> some View {
    let isSelected = option.value == selection
    return Button {
      isSearchFocused = false
      selection = option.value
      query.wrappedValue = ""
      onSelect?(option.value)
    } label: {
      HStack(spacing: 9) {
        Text(option.label)
          .font(typography.selectionLabel.font)
          .foregroundStyle(isSelected ? accent.foreground : FlowingPalette.ink)
          .lineLimit(1)
        Spacer(minLength: 8)
        if isSelected {
          Image(systemName: "checkmark")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(accent.foreground)
        }
      }
      .padding(.horizontal, 10)
      .frame(height: 30)
      .background(
        isSelected ? accent.wash : Color.clear,
        in: fieldShape
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityValue(isSelected ? strings.selected : strings.notSelected)
  }

  private var fieldShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: 8, style: .continuous)
  }
}
