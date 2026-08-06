import FlowingDayGraphCollaboration
import XCTest

final class FlowingCausalVersionTests: XCTestCase {
  func testCausalRelationsDistinguishOrderAndConcurrency() {
    let firstReplica = replicaID(1)
    let secondReplica = replicaID(2)
    let empty = FlowingCausalVersion()
    let first = FlowingCausalVersion([firstReplica: 1])
    let second = FlowingCausalVersion([secondReplica: 1])
    let merged = first.merged(with: second)

    XCTAssertEqual(empty.relation(to: empty), .equal)
    XCTAssertEqual(empty.relation(to: first), .before)
    XCTAssertEqual(first.relation(to: empty), .after)
    XCTAssertEqual(first.relation(to: second), .concurrent)
    XCTAssertEqual(merged.relation(to: first), .after)
    XCTAssertTrue(merged.observes(operationID(replica: firstReplica, counter: 1)))
    XCTAssertFalse(first.observes(operationID(replica: firstReplica, counter: 2)))
  }

  func testEntriesAreNormalizedAndDeterministicallyOrdered() {
    let firstReplica = replicaID(1)
    let secondReplica = replicaID(2)
    let version = FlowingCausalVersion([
      secondReplica: 2,
      replicaID(3): 0,
      firstReplica: 1,
    ])

    XCTAssertEqual(
      version.entries,
      [
        FlowingCausalVersionEntry(replicaID: firstReplica, counter: 1),
        FlowingCausalVersionEntry(replicaID: secondReplica, counter: 2),
      ]
    )
  }

  func testStrongIdentitiesDoNotCompareAcrossDomains() {
    let rawValue = uuid(1)
    let participant = FlowingParticipantID(rawValue)
    let replica = FlowingReplicaID(rawValue)

    XCTAssertEqual(participant.rawValue, replica.rawValue)
  }

  private func operationID(
    replica: FlowingReplicaID,
    counter: UInt64
  ) -> FlowingCollaborationOperationID {
    FlowingCollaborationOperationID(replicaID: replica, counter: counter)
  }

  private func replicaID(_ value: UInt8) -> FlowingReplicaID {
    FlowingReplicaID(uuid(value))
  }

  private func uuid(_ value: UInt8) -> UUID {
    UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, value))
  }
}
