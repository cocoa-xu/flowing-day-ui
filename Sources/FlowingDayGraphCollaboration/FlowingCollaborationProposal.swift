public struct FlowingCollaborationProposal<Schema: FlowingCollaborationSchema>:
  Equatable,
  Sendable
{
  public let proposalID: FlowingCollaborationProposalID
  public let participantID: FlowingParticipantID
  public let sessionID: FlowingCollaborationSessionID
  public let documentID: Schema.DocumentID
  public let baseVersion: FlowingCausalVersion
  public let provenance: FlowingCollaborationProvenance
  public let expiresAt: UInt64?
  public let commands: [Schema.Command]

  public init(
    proposalID: FlowingCollaborationProposalID = .init(),
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    documentID: Schema.DocumentID,
    baseVersion: FlowingCausalVersion,
    provenance: FlowingCollaborationProvenance,
    expiresAt: UInt64? = nil,
    commands: [Schema.Command]
  ) {
    self.proposalID = proposalID
    self.participantID = participantID
    self.sessionID = sessionID
    self.documentID = documentID
    self.baseVersion = baseVersion
    self.provenance = provenance
    self.expiresAt = expiresAt
    self.commands = commands
  }

  public func validate(
    for documentID: Schema.DocumentID,
    at currentVersion: FlowingCausalVersion,
    currentTick: UInt64,
    maximumCommands: Int = FlowingCollaborationLimits.standard.maximumProposalCommands,
    requiresExactBase: Bool = true
  ) -> FlowingCollaborationProposalIssue<Schema.DocumentID>? {
    guard self.documentID == documentID else {
      return .wrongDocument(expected: documentID, actual: self.documentID)
    }
    guard !commands.isEmpty else { return .emptyProposal }
    guard commands.count <= maximumCommands else {
      return .commandLimitExceeded(maximum: maximumCommands, actual: commands.count)
    }
    if let expiresAt, expiresAt <= currentTick {
      return .expired
    }
    if requiresExactBase, baseVersion != currentVersion {
      return .staleBase(expected: baseVersion, actual: currentVersion)
    }
    guard currentVersion.dominates(baseVersion) else {
      return .unknownBase
    }
    return nil
  }
}

public enum FlowingCollaborationProposalIssue<DocumentID: Hashable & Sendable>:
  Error,
  Equatable,
  Sendable
{
  case wrongDocument(expected: DocumentID, actual: DocumentID)
  case emptyProposal
  case commandLimitExceeded(maximum: Int, actual: Int)
  case expired
  case staleBase(expected: FlowingCausalVersion, actual: FlowingCausalVersion)
  case unknownBase
}
