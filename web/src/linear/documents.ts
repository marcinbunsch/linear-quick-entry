import { graphql } from './generated'

// Every query the panel sends to Linear. `pnpm codegen` turns these into typed documents.
// Reference data is fetched as separate top-level paginated queries instead of one nested query,
// because Linear rejects queries whose nested connections push the complexity score too high.

export const ViewerAndOrganizationQuery = graphql(`
  query ViewerAndOrganization {
    viewer {
      id
      name
      displayName
      avatarUrl
    }
    organization {
      id
      name
      urlKey
    }
  }
`)

export const TeamsQuery = graphql(`
  query Teams($after: String) {
    teams(first: 100, after: $after) {
      nodes {
        id
        key
        name
        color
        icon
        cyclesEnabled
        issueEstimationType
        issueEstimationAllowZero
        issueEstimationExtended
        defaultIssueState {
          id
        }
        activeCycle {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)

export const WorkflowStatesQuery = graphql(`
  query WorkflowStates($after: String) {
    workflowStates(first: 250, after: $after) {
      nodes {
        id
        name
        type
        color
        position
        team {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)

export const IssueLabelsQuery = graphql(`
  query IssueLabels($after: String) {
    issueLabels(first: 250, after: $after) {
      nodes {
        id
        name
        color
        isGroup
        retiredAt
        parent {
          id
        }
        team {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)

export const UsersQuery = graphql(`
  query Users($after: String) {
    users(first: 250, after: $after, filter: { active: { eq: true }, app: { eq: false } }) {
      nodes {
        id
        name
        displayName
        avatarUrl
        isMe
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)

export const ProjectsQuery = graphql(`
  query Projects($after: String) {
    projects(first: 100, after: $after, filter: { status: { type: { nin: ["completed", "canceled"] } } }) {
      nodes {
        id
        name
        icon
        color
        teams(first: 50) {
          nodes {
            id
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)

export const CyclesQuery = graphql(`
  query Cycles($after: String) {
    cycles(first: 100, after: $after, filter: { isPast: { eq: false } }) {
      nodes {
        id
        number
        name
        startsAt
        endsAt
        isActive
        team {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)

export const TeamMembershipsQuery = graphql(`
  query TeamMemberships($after: String) {
    teamMemberships(first: 250, after: $after) {
      nodes {
        team {
          id
        }
        user {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)

export const SearchParentIssuesQuery = graphql(`
  query SearchParentIssues($term: String!) {
    searchIssues(term: $term, first: 20, filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
      nodes {
        id
        identifier
        title
        team {
          id
        }
        project {
          id
        }
        state {
          name
          type
          color
        }
      }
    }
  }
`)

export const IssueByIdentifierQuery = graphql(`
  query IssueByIdentifier($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      team {
        id
      }
      project {
        id
      }
      state {
        name
        type
        color
      }
    }
  }
`)

export const MyOpenIssuesQuery = graphql(`
  query MyOpenIssues {
    viewer {
      assignedIssues(first: 20, orderBy: updatedAt, filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
        nodes {
          id
          identifier
          title
          team {
            id
          }
          project {
            id
          }
          state {
            name
            type
            color
          }
        }
      }
    }
  }
`)

export const CreateIssueMutation = graphql(`
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        title
        url
      }
    }
  }
`)
