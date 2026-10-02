import KeyboardShortcuts

extension KeyboardShortcuts.Name {
    /// Opens the panel, or hides it when it's already in front.
    static let newIssue = Self("newIssue", initial: .init(.l, modifiers: [.control, .option]))
    /// Opens the panel with the last parent issue already applied.
    static let newSubIssueOfLastParent = Self("newSubIssueOfLastParent", initial: .init(.l, modifiers: [.control, .option, .shift]))
}
