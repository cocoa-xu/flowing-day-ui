import FlowingDayGraphCollaboration
import Foundation
import XCTest

final class FlowingCollaborationPresenceTests: XCTestCase {
  func testOutOfOrderUpdatesCannotReplaceNewerPresence() throws {
    var store = makeStore()
    let key = presenceKey(participant: 1, session: 1)

    XCTAssertEqual(
      store.ingest(update(key: key, sequence: 2, value: "new"), expiresAt: 20, receivedAt: 10),
      .updated)
    XCTAssertEqual(
      store.ingest(update(key: key, sequence: 1, value: "old"), expiresAt: 30, receivedAt: 11),
      .stale)
    XCTAssertEqual(try XCTUnwrap(store.activeRecords.first).value, "new")
  }

  func testLeaveAndExpirationRetainReplayProtectionUntilPurged() {
    var store = makeStore()
    let left = presenceKey(participant: 1, session: 1)
    let expired = presenceKey(participant: 2, session: 2)
    _ = store.ingest(update(key: left, sequence: 1, value: "left"), expiresAt: 20, receivedAt: 10)
    _ = store.ingest(
      update(key: expired, sequence: 1, value: "expired"), expiresAt: 12, receivedAt: 10)

    XCTAssertEqual(
      store.ingest(leave(key: left, sequence: 2), expiresAt: 20, receivedAt: 11), .left)
    XCTAssertEqual(store.expire(at: 12), [expired])
    XCTAssertTrue(store.activeRecords.isEmpty)
    XCTAssertEqual(
      store.ingest(update(key: left, sequence: 1, value: "late"), expiresAt: 30, receivedAt: 13),
      .stale)
    XCTAssertEqual(
      store.ingest(update(key: expired, sequence: 1, value: "late"), expiresAt: 30, receivedAt: 13),
      .stale)
    XCTAssertEqual(store.purgeRetired(through: 11), 1)
    XCTAssertEqual(store.retainedSessionCount, 1)
  }

  func testReconnectUsesAnIndependentSession() {
    var store = makeStore()
    let old = presenceKey(participant: 1, session: 1)
    let new = presenceKey(participant: 1, session: 2)
    _ = store.ingest(update(key: old, sequence: 10, value: "old"), expiresAt: 20, receivedAt: 10)
    _ = store.ingest(update(key: new, sequence: 1, value: "new"), expiresAt: 20, receivedAt: 10)

    XCTAssertEqual(store.activeRecords.map(\.value), ["old", "new"])
  }

  func testSessionBudgetIncludesRetiredReplayWindows() {
    var store = makeStore(maximumSessions: 1)
    let first = presenceKey(participant: 1, session: 1)
    let second = presenceKey(participant: 2, session: 2)
    _ = store.ingest(update(key: first, sequence: 1, value: "first"), expiresAt: 20, receivedAt: 10)
    _ = store.ingest(leave(key: first, sequence: 2), expiresAt: 20, receivedAt: 11)

    XCTAssertEqual(
      store.ingest(
        update(key: second, sequence: 1, value: "second"), expiresAt: 30, receivedAt: 12),
      .rejected(.sessionLimitExceeded(maximum: 1))
    )
    _ = store.purgeRetired(through: 11)
    XCTAssertEqual(
      store.ingest(
        update(key: second, sequence: 1, value: "second"), expiresAt: 30, receivedAt: 12), .updated)
  }

  private func makeStore(maximumSessions: Int = 10) -> FlowingCollaborationPresenceStore<
    String, String
  > {
    FlowingCollaborationPresenceStore(documentID: "document", maximumSessions: maximumSessions)
  }

  private func update(
    key: FlowingCollaborationPresenceKey,
    sequence: UInt64,
    value: String
  ) -> FlowingCollaborationPresenceUpdate<String, String> {
    FlowingCollaborationPresenceUpdate(
      documentID: "document",
      key: key,
      sequence: sequence,
      event: .update(value)
    )
  }

  private func leave(
    key: FlowingCollaborationPresenceKey,
    sequence: UInt64
  ) -> FlowingCollaborationPresenceUpdate<String, String> {
    FlowingCollaborationPresenceUpdate(
      documentID: "document",
      key: key,
      sequence: sequence,
      event: .leave
    )
  }

  private func presenceKey(participant: Int, session: Int) -> FlowingCollaborationPresenceKey {
    FlowingCollaborationPresenceKey(
      participantID: FlowingParticipantID(uuid(participant)),
      sessionID: FlowingCollaborationSessionID(uuid(session + 20))
    )
  }

  private func uuid(_ value: Int) -> UUID {
    UUID(uuidString: String(format: "00000000-0000-0000-0000-%012X", value))!
  }
}
