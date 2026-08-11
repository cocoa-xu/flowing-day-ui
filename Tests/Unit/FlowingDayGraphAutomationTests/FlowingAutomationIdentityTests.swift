import FlowingDayGraphAutomation
import XCTest

final class FlowingAutomationIdentityTests: XCTestCase {
  func testAuthorizationScopeRevisionChangesIdentity() {
    let id = UUID()

    XCTAssertNotEqual(
      FlowingAutomationAuthorizationScopeID(id: id, revision: 1),
      FlowingAutomationAuthorizationScopeID(id: id, revision: 2)
    )
  }
}
