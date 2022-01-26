import {gql} from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
const defaultOptions = {} as const;

/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
    ID: string;
    String: string;
    Boolean: boolean;
    Int: number;
    Float: number;
};

export type Checklist = {
    __typename?: 'Checklist';
    id: Scalars['String'];
    items: Array<ChecklistItem>;
    title: Scalars['String'];
};

export type ChecklistItem = {
    __typename?: 'ChecklistItem';
    assigneeID: Scalars['String'];
    command: Scalars['String'];
    description: Scalars['String'];
    id: Scalars['String'];
    state: Scalars['String'];
    title: Scalars['String'];
};

export type Member = {
    __typename?: 'Member';
    roles: Array<Scalars['String']>;
    userID: Scalars['String'];
};

export type Mutation = {
    __typename?: 'Mutation';
    updatePlaybook: Scalars['String'];
};

export type MutationUpdatePlaybookArgs = {
    id: Scalars['String'];
    updates: PlaybookUpdates;
};

export type Playbook = {
    __typename?: 'Playbook';
    checklists: Array<Checklist>;
    createPublicPlaybookRun: Scalars['Boolean'];
    defaultPlaybookMemberRole: Scalars['String'];
    deleteAt: Scalars['Float'];
    description: Scalars['String'];
    id: Scalars['String'];
    members: Array<Member>;
    public: Scalars['Boolean'];
    runSummaryTemplateEnabled: Scalars['Boolean'];
    teamID: Scalars['String'];
    title: Scalars['String'];
};

export type PlaybookUpdates = {
    description?: InputMaybe<Scalars['String']>;
    title?: InputMaybe<Scalars['String']>;
};

export type Query = {
    __typename?: 'Query';
    playbook?: Maybe<Playbook>;
};

export type QueryPlaybookArgs = {
    id: Scalars['String'];
};

export type PlaybookQueryVariables = Exact<{
    id: Scalars['String'];
}>;

export type PlaybookQuery = { __typename?: 'Query', playbook?: { __typename?: 'Playbook', id: string, title: string, description: string, public: boolean, team_id: string, delete_at: number, default_playbook_member_role: string, checklists: Array<{ __typename?: 'Checklist', title: string }>, members: Array<{ __typename?: 'Member', roles: Array<string>, user_id: string }> } | null };

export const PlaybookDocument = gql`
    query Playbook($id: String!) {
  playbook(id: $id) {
    id
    title
    description
    team_id: teamID
    public
    delete_at: deleteAt
    default_playbook_member_role: defaultPlaybookMemberRole
    checklists {
      title
    }
    members {
      user_id: userID
      roles
    }
  }
}
    `;

/**
 * __usePlaybookQuery__
 *
 * To run a query within a React component, call `usePlaybookQuery` and pass it any options that fit your needs.
 * When your component renders, `usePlaybookQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePlaybookQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function usePlaybookQuery(baseOptions: Apollo.QueryHookOptions<PlaybookQuery, PlaybookQueryVariables>) {
    const options = {...defaultOptions, ...baseOptions};
    return Apollo.useQuery<PlaybookQuery, PlaybookQueryVariables>(PlaybookDocument, options);
}
export function usePlaybookLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PlaybookQuery, PlaybookQueryVariables>) {
    const options = {...defaultOptions, ...baseOptions};
    return Apollo.useLazyQuery<PlaybookQuery, PlaybookQueryVariables>(PlaybookDocument, options);
}
export type PlaybookQueryHookResult = ReturnType<typeof usePlaybookQuery>;
export type PlaybookLazyQueryHookResult = ReturnType<typeof usePlaybookLazyQuery>;
export type PlaybookQueryResult = Apollo.QueryResult<PlaybookQuery, PlaybookQueryVariables>;

export interface PossibleTypesResultData {
    possibleTypes: {
        [key: string]: string[]
    }
}
const result: PossibleTypesResultData = {
    possibleTypes: {},
};
export default result;
