/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query ViewerAndOrganization {\n    viewer {\n      id\n      name\n      displayName\n      avatarUrl\n    }\n    organization {\n      id\n      name\n      urlKey\n    }\n  }\n": typeof types.ViewerAndOrganizationDocument,
    "\n  query Teams($after: String) {\n    teams(first: 100, after: $after) {\n      nodes {\n        id\n        key\n        name\n        color\n        icon\n        cyclesEnabled\n        issueEstimationType\n        issueEstimationAllowZero\n        issueEstimationExtended\n        defaultIssueState {\n          id\n        }\n        activeCycle {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.TeamsDocument,
    "\n  query WorkflowStates($after: String) {\n    workflowStates(first: 250, after: $after) {\n      nodes {\n        id\n        name\n        type\n        color\n        position\n        team {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.WorkflowStatesDocument,
    "\n  query IssueLabels($after: String) {\n    issueLabels(first: 250, after: $after) {\n      nodes {\n        id\n        name\n        color\n        isGroup\n        retiredAt\n        parent {\n          id\n        }\n        team {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.IssueLabelsDocument,
    "\n  query Users($after: String) {\n    users(first: 250, after: $after, filter: { active: { eq: true }, app: { eq: false } }) {\n      nodes {\n        id\n        name\n        displayName\n        avatarUrl\n        isMe\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.UsersDocument,
    "\n  query Projects($after: String) {\n    projects(first: 100, after: $after, filter: { status: { type: { nin: [\"completed\", \"canceled\"] } } }) {\n      nodes {\n        id\n        name\n        icon\n        color\n        teams(first: 50) {\n          nodes {\n            id\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.ProjectsDocument,
    "\n  query Cycles($after: String) {\n    cycles(first: 100, after: $after, filter: { isPast: { eq: false } }) {\n      nodes {\n        id\n        number\n        name\n        startsAt\n        endsAt\n        isActive\n        team {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.CyclesDocument,
    "\n  query TeamMemberships($after: String) {\n    teamMemberships(first: 250, after: $after) {\n      nodes {\n        team {\n          id\n        }\n        user {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.TeamMembershipsDocument,
    "\n  query SearchParentIssues($term: String!) {\n    searchIssues(term: $term, first: 20, filter: { state: { type: { nin: [\"completed\", \"canceled\"] } } }) {\n      nodes {\n        id\n        identifier\n        title\n        team {\n          id\n        }\n        project {\n          id\n        }\n        state {\n          name\n          type\n          color\n        }\n      }\n    }\n  }\n": typeof types.SearchParentIssuesDocument,
    "\n  query IssueByIdentifier($id: String!) {\n    issue(id: $id) {\n      id\n      identifier\n      title\n      team {\n        id\n      }\n      project {\n        id\n      }\n      state {\n        name\n        type\n        color\n      }\n    }\n  }\n": typeof types.IssueByIdentifierDocument,
    "\n  query MyOpenIssues {\n    viewer {\n      assignedIssues(first: 20, orderBy: updatedAt, filter: { state: { type: { nin: [\"completed\", \"canceled\"] } } }) {\n        nodes {\n          id\n          identifier\n          title\n          team {\n            id\n          }\n          project {\n            id\n          }\n          state {\n            name\n            type\n            color\n          }\n        }\n      }\n    }\n  }\n": typeof types.MyOpenIssuesDocument,
    "\n  mutation CreateIssue($input: IssueCreateInput!) {\n    issueCreate(input: $input) {\n      success\n      issue {\n        id\n        identifier\n        title\n        url\n      }\n    }\n  }\n": typeof types.CreateIssueDocument,
};
const documents: Documents = {
    "\n  query ViewerAndOrganization {\n    viewer {\n      id\n      name\n      displayName\n      avatarUrl\n    }\n    organization {\n      id\n      name\n      urlKey\n    }\n  }\n": types.ViewerAndOrganizationDocument,
    "\n  query Teams($after: String) {\n    teams(first: 100, after: $after) {\n      nodes {\n        id\n        key\n        name\n        color\n        icon\n        cyclesEnabled\n        issueEstimationType\n        issueEstimationAllowZero\n        issueEstimationExtended\n        defaultIssueState {\n          id\n        }\n        activeCycle {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.TeamsDocument,
    "\n  query WorkflowStates($after: String) {\n    workflowStates(first: 250, after: $after) {\n      nodes {\n        id\n        name\n        type\n        color\n        position\n        team {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.WorkflowStatesDocument,
    "\n  query IssueLabels($after: String) {\n    issueLabels(first: 250, after: $after) {\n      nodes {\n        id\n        name\n        color\n        isGroup\n        retiredAt\n        parent {\n          id\n        }\n        team {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.IssueLabelsDocument,
    "\n  query Users($after: String) {\n    users(first: 250, after: $after, filter: { active: { eq: true }, app: { eq: false } }) {\n      nodes {\n        id\n        name\n        displayName\n        avatarUrl\n        isMe\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.UsersDocument,
    "\n  query Projects($after: String) {\n    projects(first: 100, after: $after, filter: { status: { type: { nin: [\"completed\", \"canceled\"] } } }) {\n      nodes {\n        id\n        name\n        icon\n        color\n        teams(first: 50) {\n          nodes {\n            id\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.ProjectsDocument,
    "\n  query Cycles($after: String) {\n    cycles(first: 100, after: $after, filter: { isPast: { eq: false } }) {\n      nodes {\n        id\n        number\n        name\n        startsAt\n        endsAt\n        isActive\n        team {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.CyclesDocument,
    "\n  query TeamMemberships($after: String) {\n    teamMemberships(first: 250, after: $after) {\n      nodes {\n        team {\n          id\n        }\n        user {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.TeamMembershipsDocument,
    "\n  query SearchParentIssues($term: String!) {\n    searchIssues(term: $term, first: 20, filter: { state: { type: { nin: [\"completed\", \"canceled\"] } } }) {\n      nodes {\n        id\n        identifier\n        title\n        team {\n          id\n        }\n        project {\n          id\n        }\n        state {\n          name\n          type\n          color\n        }\n      }\n    }\n  }\n": types.SearchParentIssuesDocument,
    "\n  query IssueByIdentifier($id: String!) {\n    issue(id: $id) {\n      id\n      identifier\n      title\n      team {\n        id\n      }\n      project {\n        id\n      }\n      state {\n        name\n        type\n        color\n      }\n    }\n  }\n": types.IssueByIdentifierDocument,
    "\n  query MyOpenIssues {\n    viewer {\n      assignedIssues(first: 20, orderBy: updatedAt, filter: { state: { type: { nin: [\"completed\", \"canceled\"] } } }) {\n        nodes {\n          id\n          identifier\n          title\n          team {\n            id\n          }\n          project {\n            id\n          }\n          state {\n            name\n            type\n            color\n          }\n        }\n      }\n    }\n  }\n": types.MyOpenIssuesDocument,
    "\n  mutation CreateIssue($input: IssueCreateInput!) {\n    issueCreate(input: $input) {\n      success\n      issue {\n        id\n        identifier\n        title\n        url\n      }\n    }\n  }\n": types.CreateIssueDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ViewerAndOrganization {\n    viewer {\n      id\n      name\n      displayName\n      avatarUrl\n    }\n    organization {\n      id\n      name\n      urlKey\n    }\n  }\n"): typeof import('./graphql').ViewerAndOrganizationDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Teams($after: String) {\n    teams(first: 100, after: $after) {\n      nodes {\n        id\n        key\n        name\n        color\n        icon\n        cyclesEnabled\n        issueEstimationType\n        issueEstimationAllowZero\n        issueEstimationExtended\n        defaultIssueState {\n          id\n        }\n        activeCycle {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): typeof import('./graphql').TeamsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query WorkflowStates($after: String) {\n    workflowStates(first: 250, after: $after) {\n      nodes {\n        id\n        name\n        type\n        color\n        position\n        team {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): typeof import('./graphql').WorkflowStatesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query IssueLabels($after: String) {\n    issueLabels(first: 250, after: $after) {\n      nodes {\n        id\n        name\n        color\n        isGroup\n        retiredAt\n        parent {\n          id\n        }\n        team {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): typeof import('./graphql').IssueLabelsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Users($after: String) {\n    users(first: 250, after: $after, filter: { active: { eq: true }, app: { eq: false } }) {\n      nodes {\n        id\n        name\n        displayName\n        avatarUrl\n        isMe\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): typeof import('./graphql').UsersDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Projects($after: String) {\n    projects(first: 100, after: $after, filter: { status: { type: { nin: [\"completed\", \"canceled\"] } } }) {\n      nodes {\n        id\n        name\n        icon\n        color\n        teams(first: 50) {\n          nodes {\n            id\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): typeof import('./graphql').ProjectsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Cycles($after: String) {\n    cycles(first: 100, after: $after, filter: { isPast: { eq: false } }) {\n      nodes {\n        id\n        number\n        name\n        startsAt\n        endsAt\n        isActive\n        team {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): typeof import('./graphql').CyclesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TeamMemberships($after: String) {\n    teamMemberships(first: 250, after: $after) {\n      nodes {\n        team {\n          id\n        }\n        user {\n          id\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): typeof import('./graphql').TeamMembershipsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SearchParentIssues($term: String!) {\n    searchIssues(term: $term, first: 20, filter: { state: { type: { nin: [\"completed\", \"canceled\"] } } }) {\n      nodes {\n        id\n        identifier\n        title\n        team {\n          id\n        }\n        project {\n          id\n        }\n        state {\n          name\n          type\n          color\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').SearchParentIssuesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query IssueByIdentifier($id: String!) {\n    issue(id: $id) {\n      id\n      identifier\n      title\n      team {\n        id\n      }\n      project {\n        id\n      }\n      state {\n        name\n        type\n        color\n      }\n    }\n  }\n"): typeof import('./graphql').IssueByIdentifierDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MyOpenIssues {\n    viewer {\n      assignedIssues(first: 20, orderBy: updatedAt, filter: { state: { type: { nin: [\"completed\", \"canceled\"] } } }) {\n        nodes {\n          id\n          identifier\n          title\n          team {\n            id\n          }\n          project {\n            id\n          }\n          state {\n            name\n            type\n            color\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').MyOpenIssuesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateIssue($input: IssueCreateInput!) {\n    issueCreate(input: $input) {\n      success\n      issue {\n        id\n        identifier\n        title\n        url\n      }\n    }\n  }\n"): typeof import('./graphql').CreateIssueDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
