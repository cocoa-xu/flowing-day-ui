import SwiftUI

public enum FlowingDatePickerComponents: String, CaseIterable, Hashable, Sendable {
  case date
  case time
  case dateAndTime

  var displayedComponents: DatePickerComponents {
    switch self {
    case .date: [.date]
    case .time: [.hourAndMinute]
    case .dateAndTime: [.date, .hourAndMinute]
    }
  }
}

public struct FlowingDatePicker<Label: View>: View {
  @Binding private var selection: Date
  private let bounds: ClosedRange<Date>?
  private let components: FlowingDatePickerComponents
  private let label: Label

  public init(
    selection: Binding<Date>,
    in bounds: ClosedRange<Date>? = nil,
    components: FlowingDatePickerComponents = .dateAndTime,
    @ViewBuilder label: () -> Label
  ) {
    _selection = selection
    self.bounds = bounds
    self.components = components
    self.label = label()
  }

  public var body: some View {
    datePicker
      .datePickerStyle(.field)
      .controlSize(.small)
  }

  @ViewBuilder
  private var datePicker: some View {
    if let bounds {
      DatePicker(
        selection: $selection,
        in: bounds,
        displayedComponents: components.displayedComponents
      ) {
        label
      }
    } else {
      DatePicker(
        selection: $selection,
        displayedComponents: components.displayedComponents
      ) {
        label
      }
    }
  }
}

extension FlowingDatePicker where Label == Text {
  public init(
    _ title: String,
    selection: Binding<Date>,
    in bounds: ClosedRange<Date>? = nil,
    components: FlowingDatePickerComponents = .dateAndTime
  ) {
    self.init(
      selection: selection,
      in: bounds,
      components: components
    ) {
      Text(title)
    }
  }
}
