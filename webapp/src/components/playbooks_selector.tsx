
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {ApolloProvider} from '@apollo/client';
import {BookLockOutlineIcon, BookOutlineIcon, PlusIcon} from '@mattermost/compass-icons/components';
import Scrollbars from 'react-custom-scrollbars';
import {DateTime} from 'luxon';

import {usePlaybooksModalQuery} from 'src/graphql/generated_types';
import {getPlaybooksGraphQLClient} from 'src/graphql_client';

import {PrimaryButton} from 'src/components/assets/buttons';
import SearchSvg from 'src/components/assets/illustrations/search_svg';
import ClipboardChecklistSvg from 'src/components/assets/illustrations/clipboard_checklist_svg';
import LoadingSpinner from 'src/components/assets/loading_spinner';

interface Props {
    teamID: string;
    channelID: string;
    searchTerm: string;

    /**
     * Callback that will trigger if the conditions for zero case no results are met.
     */
    onZeroCaseNoPlaybooks: (zerocase: boolean) => void;
    onCreatePlaybook: () => void;
    onSelectPlaybook: (playbookId: string) => void;
}

const PlaybooksSelector = (props: Props) => {
    const {formatMessage} = useIntl();
    const {data, loading} = usePlaybooksModalQuery({
        variables: {
            teamID: props.teamID,
            searchTerm: props.searchTerm,
            channelID: props.channelID,
        },
        fetchPolicy: 'cache-and-network',
    });

    // Groups are mutually exclusive
    // -> 1) if channelid -> -unique- playbooks whose runs are in linked to this channel
    // -> 2) playbooks I'm member of and are not contained in 1
    // -> 3) playbooks I have access to and are not contained in 1 and 2
    const getGroups = () => {
        const groupUsed = props.channelID ? data?.allPlaybooks.filter((playbook) => data.channelPlaybooks.edges?.find((target) => target.node?.playbookID === playbook.id)) : [];
        const groupYours = data?.yourPlaybooks.filter((playbook) => !groupUsed?.find((target) => target.id === playbook.id));
        const groupOther = data?.allPlaybooks.filter((playbook) =>
            !data.yourPlaybooks.find((target) => target.id === playbook.id) &&
            !groupUsed?.find((target) => target.id === playbook.id)
        );

        return [
            {
                title: formatMessage({defaultMessage: 'Used in this channel'}),
                list: groupUsed,
            },
            {
                title: formatMessage({defaultMessage: 'Your playbooks'}),
                list: groupYours,
            },
            {
                title: formatMessage({defaultMessage: 'Other playbooks'}),
                list: groupOther,
            },
        ];
    };

    const groups = getGroups();
    const hasResults = Boolean(data?.allPlaybooks && data?.allPlaybooks.length > 0);

    // Invoke callback to notify parent if the zero case triggered
    if (!loading) {
        props.onZeroCaseNoPlaybooks(props.searchTerm === '' && !hasResults);
    }
    const iconProps = {
        size: 18,
        color: 'rgba(var(--center-channel-color-rgb), 0.56)',
    };

    if (!hasResults && !loading) {
        return props.searchTerm === '' ? (
            <ErrorContainer>
                <ClipboardSvg/>
                <ErrorTitle>{formatMessage({defaultMessage: 'Get started with Playbooks'}, {searchTerm: props.searchTerm})}</ErrorTitle>
                <ErrorSubTitle>{formatMessage({defaultMessage: 'Playbooks are configurable checklists that define a repeatable process for teams to achieve specific and predictable outcomes'})}</ErrorSubTitle>
                <PrimaryButton onClick={props.onCreatePlaybook}>
                    <Plus size={16}/>
                    <FormattedMessage defaultMessage='Create new playbook'/>
                </PrimaryButton>
            </ErrorContainer>
        ) : (
            <ErrorContainer>
                <SearchSvg/>
                <ErrorTitle>{formatMessage({defaultMessage: 'No results for "{searchTerm}"'}, {searchTerm: props.searchTerm})}</ErrorTitle>
                <ErrorSubTitle>{formatMessage({defaultMessage: 'Please check spelling or try another search'})}</ErrorSubTitle>
            </ErrorContainer>
        );
    }

    if (loading) {
        return <LoadingContainer><LoadingSpinner/></LoadingContainer>;
    }

    return (
        <Container>
            <Scrollbars
                autoHide={true}
                autoHideTimeout={500}
                autoHideDuration={500}
            >
                {groups.map((group) => (
                    <>
                        {group.list && group.list.length > 0 && <GroupTitle>{group.title}</GroupTitle>}
                        <Group>
                            {group.list?.map((playbook) => (
                                <Item
                                    key={`item-${playbook.id}`}
                                    onClick={() => props.onSelectPlaybook(playbook.id)}
                                >
                                    <ItemIcon>
                                        {playbook.public ? <BookOutlineIcon {...iconProps}/> : <BookLockOutlineIcon {...iconProps}/>}
                                    </ItemIcon>
                                    <ItemCenter>
                                        <ItemTitle>{playbook.title}</ItemTitle>
                                        <ItemSubTitle>
                                            <span>{playbook.lastRunAt === 0 ? formatMessage({defaultMessage: 'Never used'}) : formatMessage({defaultMessage: 'Last used {time}'}, {time: DateTime.fromMillis(playbook.lastRunAt).toRelative()})}</span>
                                            <Dot/>
                                            <span>{formatMessage({defaultMessage: '{count, plural, =1{1 run in progress} =0 {No runs in progress} other {# runs in progress}}'}, {count: playbook.activeRuns})}</span>
                                        </ItemSubTitle>
                                    </ItemCenter>
                                    <ButtonWrappper className='modal-list-cta'>
                                        <PrimaryButton>{formatMessage({defaultMessage: 'Select'})}</PrimaryButton>
                                    </ButtonWrappper>
                                </Item>
                            ))}
                        </Group>
                    </>
                ))}
            </Scrollbars>
        </Container>
    );
};

const WrappedPlaybooksSelector = (props: Props) => {
    const client = getPlaybooksGraphQLClient();
    return <ApolloProvider client={client}><PlaybooksSelector {...props}/></ApolloProvider>;
};
export default WrappedPlaybooksSelector;

const Dot = styled.span`
    font-weight: 600;
    margin: 0 5px;
    font-size: 18px;
    ::before {
        content: '·';
    }
`;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 350px;
`;
const GroupTitle = styled.div`
    font-size:  12px;
    line-height: 16px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    text-transform: uppercase;
`;
const Group = styled.div`
    display: flex;
    flex-direction: column;
    margin: 0 0 10px 0;
    padding: 0;
`;

const Item = styled.div`
    display: flex;
    flex-direction: row;
    cursor: pointer;
    padding: 10px 0;
    margin-right: 10px;
    border-radius: 4px;
    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
        .modal-list-cta {
            display: block;
        }
    }
`;

const ItemIcon = styled.div`
    display: flex;
    align-items: flex-start;
    padding: 0 10px 0 5px;
`;
const ItemCenter = styled.div`
    display: flex;
    flex-direction: column;
`;

const ItemTitle = styled.div`
    font-size:  14px;
    line-height: 20px;
    font-weight: 400;
    color: var(--center-channel-color);
    margin-bottom: 4px;
`;
const ItemSubTitle = styled.div`
    display: flex;
    align-items: center;
    font-size:  12px;
    line-height: 16px;
    font-weight: 400;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const ButtonWrappper = styled.div`
    margin-left: auto;
    margin-right: 10px;
    display: none;
`;

const ErrorContainer = styled(Container)`
    align-items: center;
    justify-content: center;
    align-self: center;
    gap: 15px;
    max-width: 450px;
`;

const ErrorTitle = styled.div`
    font-size: 18px;
    font-weight: 600;
    color: var(--center-channel-color);
    text-align: center;
`;

const ErrorSubTitle = styled(ErrorTitle)`
    font-size: 14px;
    font-weight: 400;
`;

const Plus = styled(PlusIcon)`
    margin-right: 5px;
`;

const ClipboardSvg = styled(ClipboardChecklistSvg)`
    height:150px;
    width:150px;
`;

const LoadingContainer = styled(Container)`
    padding-top: 10px;
    align-items: center;
`;
