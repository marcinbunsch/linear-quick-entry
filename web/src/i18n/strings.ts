// Every user-facing string in the panel. English only for now; the shape is the contract for translations.

function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

export const strings = {
  header: {
    newIssue: 'New issue',
    newSubIssue: 'New sub-issue',
    removeParent: 'Remove parent',
    suggestParent: (identifier: string) => `Sub-issue of ${identifier}?`,
    close: 'Close',
  },
  title: {
    placeholder: 'Issue title',
  },
  description: {
    placeholder: 'Add description…',
  },
  fields: {
    team: 'Team',
    status: 'Status',
    priority: 'Priority',
    assignee: 'Assignee',
    unassigned: 'No assignee',
    you: 'You',
    project: 'Project',
    noProject: 'No project',
    estimate: 'Estimate',
    noEstimate: 'No estimate',
    labels: 'Labels',
    cycle: 'Cycle',
    noCycle: 'No cycle',
    currentCycle: 'Current',
    dueDate: 'Due date',
    noDueDate: 'No due date',
    parent: 'Parent issue',
    setParent: 'Set parent issue…',
    more: 'More fields',
  },
  pickers: {
    searchPlaceholder: (field: string) => `Change ${field.toLowerCase()}…`,
    noResults: 'No results',
    searching: 'Searching…',
    parentSearchPlaceholder: 'Search issues or type an ID like ENG-123…',
    recentParents: 'Recent parents',
    myIssues: 'My open issues',
    searchResults: 'Results',
    dueDatePlaceholder: 'Try "friday", "in 2 weeks" or "Oct 12"…',
    dueDatePresets: 'Suggestions',
    moreFieldsPlaceholder: 'Add a field…',
    clear: 'Clear',
  },
  dueDatePresets: {
    today: 'Today',
    tomorrow: 'Tomorrow',
    endOfWeek: 'End of this week',
    nextWeek: 'In one week',
  },
  attachments: {
    attachFiles: 'Attach images or videos',
    screenshot: 'Capture a screenshot',
    dropInline: 'Drop to add here',
    dropTray: 'Drop to attach',
    retry: 'Retry',
    remove: 'Remove',
    uploading: 'Uploading…',
    failed: 'Upload failed',
    missingFile: 'The file is no longer on disk',
    rejected: (names: string[]) => `Skipped ${listNames(names)}: only images and videos can be attached`,
  },
  footer: {
    create: 'Create issue',
    creating: 'Creating…',
    waitingForUploads: 'Waiting for uploads…',
    createMore: 'Create more',
  },
  status: {
    loadingWorkspace: 'Loading your workspace…',
    refreshFailed: (message: string) => `Couldn't refresh workspace data: ${message}`,
    openSettings: 'Open Settings',
    retry: 'Retry',
  },
  errors: {
    missingApiKey: 'Add your Linear API key in Settings to create issues.',
    invalidApiKey: 'Linear rejected the API key. Check it in Settings.',
    network: "Couldn't reach Linear. Check your connection and try again.",
    rateLimited: 'Linear is rate limiting requests. Wait a moment and try again.',
    noTeam: 'Pick a team first.',
    noTitle: 'Give the issue a title.',
    createRejected: 'Linear did not create the issue. Try again.',
    uploadsFailed: (names: string[]) => `${listNames(names)} failed to upload. Retry or remove them.`,
  },
} as const
