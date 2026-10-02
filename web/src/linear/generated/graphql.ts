/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
/** Input for creating a new issue. At minimum, a team must be specified. A title is required unless a template is provided. All other fields are optional and will use defaults from the team or template if not specified. */
export type IssueCreateInput = {
  /** The identifier of the user to assign the issue to. */
  assigneeId?: string | null | undefined;
  /** The time at which the issue was completed (e.g. if importing from another system). Must be a time in the past and after createdAt. Cannot be provided with an incompatible workflow state. */
  completedAt?: string | null | undefined;
  /** Create issue as a user with the provided name. This option is only available to OAuth applications creating issues in `actor=app` mode. */
  createAsUser?: string | null | undefined;
  /** The time at which the issue was created (e.g. if importing from another system). Must be a time in the past. If none is provided, the backend will generate the time as now. */
  createdAt?: string | null | undefined;
  /** The cycle associated with the issue. */
  cycleId?: string | null | undefined;
  /** The identifier of the agent user to delegate the issue to. */
  delegateId?: string | null | undefined;
  /** The issue description in markdown format. */
  description?: string | null | undefined;
  /** [Internal] The issue description as a Prosemirror document. */
  descriptionData?: unknown;
  /** Provide an external user avatar URL. Can only be used in conjunction with the `createAsUser` options. This option is only available to OAuth applications creating comments in `actor=app` mode. */
  displayIconUrl?: string | null | undefined;
  /** The date at which the issue is due. */
  dueDate?: string | null | undefined;
  /** The estimated complexity of the issue. */
  estimate?: number | null | undefined;
  /** The identifier in UUID v4 format. If none is provided, the backend will generate one. */
  id?: string | null | undefined;
  /** [Internal] Whether this issue should inherit shared access from its parent issue. Set to false to opt out of automatic shared access inheritance when creating a sub-issue. */
  inheritsSharedAccess?: boolean | null | undefined;
  /** The identifiers of the issue labels associated with this ticket. */
  labelIds?: Array<string> | null | undefined;
  /** The ID of the last template applied to the issue. */
  lastAppliedTemplateId?: string | null | undefined;
  /** The identifier of the parent issue. Can be a UUID or issue identifier (e.g., 'LIN-123'). */
  parentId?: string | null | undefined;
  /** Whether the passed sort order should be preserved. */
  preserveSortOrderOnCreate?: boolean | null | undefined;
  /** The priority of the issue. 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low. */
  priority?: number | null | undefined;
  /** The position of the issue related to other issues, when ordered by priority. */
  prioritySortOrder?: number | null | undefined;
  /** The project associated with the issue. Can be a UUID or project identifier (e.g., 'P-LIN-123'). */
  projectId?: string | null | undefined;
  /** The project milestone associated with the issue. */
  projectMilestoneId?: string | null | undefined;
  /** The comment the issue is referencing. */
  referenceCommentId?: string | null | undefined;
  /** The identifiers of the releases to associate with this issue. */
  releaseIds?: Array<string> | null | undefined;
  /** [Internal] The time at which an issue will be considered in breach of SLA. */
  slaBreachesAt?: string | null | undefined;
  /** [Internal] The time at which the issue's SLA was started. */
  slaStartedAt?: string | null | undefined;
  /** The SLA day count type for the issue. Whether SLA should be business days only or calendar days (default). */
  slaType?: SlaDayCountType | null | undefined;
  /** The position of the issue related to other issues. */
  sortOrder?: number | null | undefined;
  /** The comment the issue is created from. */
  sourceCommentId?: string | null | undefined;
  /** [Internal] The pull request comment the issue is created from. */
  sourcePullRequestCommentId?: string | null | undefined;
  /** The team state of the issue. */
  stateId?: string | null | undefined;
  /** The position of the issue in parent's sub-issue list. */
  subIssueSortOrder?: number | null | undefined;
  /** The identifiers of the users subscribing to this ticket. */
  subscriberIds?: Array<string> | null | undefined;
  /** The identifier of the team associated with the issue. */
  teamId: string;
  /** The identifier of a template the issue should be created from. If other values are provided in the input, they will override template values. */
  templateId?: string | null | undefined;
  /** The title of the issue. */
  title?: string | null | undefined;
  /** Whether to use the default template for the team. When set to true, the default template of this team based on user's membership will be applied. */
  useDefaultTemplate?: boolean | null | undefined;
};

/** Which day count to use for SLA calculations. */
export type SlaDayCountType =
  | 'all'
  | 'onlyBusinessDays';

export type ViewerAndOrganizationQueryVariables = Exact<{ [key: string]: never; }>;


export type ViewerAndOrganizationQuery = { viewer: { id: string, name: string, displayName: string, avatarUrl: string | null }, organization: { id: string, name: string, urlKey: string } };

export type TeamsQueryVariables = Exact<{
  after?: string | null | undefined;
}>;


export type TeamsQuery = { teams: { nodes: Array<{ id: string, key: string, name: string, color: string | null, icon: string | null, cyclesEnabled: boolean, issueEstimationType: string, issueEstimationAllowZero: boolean, issueEstimationExtended: boolean, defaultIssueState: { id: string } | null, activeCycle: { id: string } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type WorkflowStatesQueryVariables = Exact<{
  after?: string | null | undefined;
}>;


export type WorkflowStatesQuery = { workflowStates: { nodes: Array<{ id: string, name: string, type: string, color: string, position: number, team: { id: string } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type IssueLabelsQueryVariables = Exact<{
  after?: string | null | undefined;
}>;


export type IssueLabelsQuery = { issueLabels: { nodes: Array<{ id: string, name: string, color: string, isGroup: boolean, retiredAt: string | null, parent: { id: string } | null, team: { id: string } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type UsersQueryVariables = Exact<{
  after?: string | null | undefined;
}>;


export type UsersQuery = { users: { nodes: Array<{ id: string, name: string, displayName: string, avatarUrl: string | null, isMe: boolean }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type ProjectsQueryVariables = Exact<{
  after?: string | null | undefined;
}>;


export type ProjectsQuery = { projects: { nodes: Array<{ id: string, name: string, icon: string | null, color: string, teams: { nodes: Array<{ id: string }> } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type CyclesQueryVariables = Exact<{
  after?: string | null | undefined;
}>;


export type CyclesQuery = { cycles: { nodes: Array<{ id: string, number: number, name: string | null, startsAt: string, endsAt: string, isActive: boolean, team: { id: string } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type TeamMembershipsQueryVariables = Exact<{
  after?: string | null | undefined;
}>;


export type TeamMembershipsQuery = { teamMemberships: { nodes: Array<{ team: { id: string }, user: { id: string } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type SearchParentIssuesQueryVariables = Exact<{
  term: string;
}>;


export type SearchParentIssuesQuery = { searchIssues: { nodes: Array<{ id: string, identifier: string, title: string, team: { id: string }, project: { id: string } | null, state: { name: string, type: string, color: string } }> } };

export type IssueByIdentifierQueryVariables = Exact<{
  id: string;
}>;


export type IssueByIdentifierQuery = { issue: { id: string, identifier: string, title: string, team: { id: string }, project: { id: string } | null, state: { name: string, type: string, color: string } } };

export type MyOpenIssuesQueryVariables = Exact<{ [key: string]: never; }>;


export type MyOpenIssuesQuery = { viewer: { assignedIssues: { nodes: Array<{ id: string, identifier: string, title: string, team: { id: string }, project: { id: string } | null, state: { name: string, type: string, color: string } }> } } };

export type CreateIssueMutationVariables = Exact<{
  input: IssueCreateInput;
}>;


export type CreateIssueMutation = { issueCreate: { success: boolean, issue: { id: string, identifier: string, title: string, url: string } | null } };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const ViewerAndOrganizationDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<ViewerAndOrganizationQuery, ViewerAndOrganizationQueryVariables>;
export const TeamsDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<TeamsQuery, TeamsQueryVariables>;
export const WorkflowStatesDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<WorkflowStatesQuery, WorkflowStatesQueryVariables>;
export const IssueLabelsDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<IssueLabelsQuery, IssueLabelsQueryVariables>;
export const UsersDocument = new TypedDocumentString(`
    query Users($after: String) {
  users(
    first: 250
    after: $after
    filter: { active: { eq: true }, app: { eq: false } }
  ) {
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
    `) as unknown as TypedDocumentString<UsersQuery, UsersQueryVariables>;
export const ProjectsDocument = new TypedDocumentString(`
    query Projects($after: String) {
  projects(
    first: 100
    after: $after
    filter: { status: { type: { nin: ["completed", "canceled"] } } }
  ) {
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
    `) as unknown as TypedDocumentString<ProjectsQuery, ProjectsQueryVariables>;
export const CyclesDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<CyclesQuery, CyclesQueryVariables>;
export const TeamMembershipsDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<TeamMembershipsQuery, TeamMembershipsQueryVariables>;
export const SearchParentIssuesDocument = new TypedDocumentString(`
    query SearchParentIssues($term: String!) {
  searchIssues(
    term: $term
    first: 20
    filter: { state: { type: { nin: ["completed", "canceled"] } } }
  ) {
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
    `) as unknown as TypedDocumentString<SearchParentIssuesQuery, SearchParentIssuesQueryVariables>;
export const IssueByIdentifierDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<IssueByIdentifierQuery, IssueByIdentifierQueryVariables>;
export const MyOpenIssuesDocument = new TypedDocumentString(`
    query MyOpenIssues {
  viewer {
    assignedIssues(
      first: 20
      orderBy: updatedAt
      filter: { state: { type: { nin: ["completed", "canceled"] } } }
    ) {
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
    `) as unknown as TypedDocumentString<MyOpenIssuesQuery, MyOpenIssuesQueryVariables>;
export const CreateIssueDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<CreateIssueMutation, CreateIssueMutationVariables>;