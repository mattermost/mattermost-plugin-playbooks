
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {ApolloProvider} from '@apollo/client';
import {BookOutlineIcon, BookLockOutlineIcon} from '@mattermost/compass-icons/components';
import Scrollbars from 'react-custom-scrollbars';

import {usePlaybooksModalQuery} from 'src/graphql/generated_types';
import {getPlaybooksGraphQLClient} from 'src/graphql_client';
import {renderThumbVertical, renderTrackHorizontal, renderView} from 'src/components/rhs/rhs_shared';
import {PrimaryButton} from 'src/components/assets/buttons';

interface Props {
    teamID: string;
    onSelectPlaybook: (playbookId: string) => void;
}

const PlaybooksSelector = (props: Props) => {
    const {formatMessage} = useIntl();
    const {data, error} = usePlaybooksModalQuery({
        variables: {
            teamID: props.teamID,
            searchTerm: '',
        },
        fetchPolicy: 'cache-and-network',
    });

    const groups = [

        // To be implemented
        // {
        //     title: formatMessage({defaultMessage: 'Used in this channel'}),
        //     list: data?.allPlaybooks,
        // },
        {
            title: formatMessage({defaultMessage: 'Your playbooks'}),
            list: data?.yourPlaybooks,
        },
        {
            title: formatMessage({defaultMessage: 'Other playbooks'}),
            list: data?.allPlaybooks.filter((playbook) => !data.yourPlaybooks.find((target) => target.id === playbook.id)),
        },
    ];
    const iconProps = {
        size: 18,
        color: 'rgba(var(--center-channel-color-rgb), 0.56)',
    };

    return (
        <Container>
            <Scrollbars
                autoHide={true}
                autoHideTimeout={500}
                autoHideDuration={500}
                renderThumbVertical={renderThumbVertical}
                renderView={renderView}
                renderTrackHorizontal={renderTrackHorizontal}
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
                                            <span>{formatMessage({defaultMessage: 'Last used'})}</span>
                                            <Dot/>
                                            <span>{formatMessage({defaultMessage: '{count, plural, =1{1 run in progress} =0 {No runs in progress} other {# runs in progress}}'}, {count: playbook.activeRuns})}</span>
                                        </ItemSubTitle>
                                    </ItemCenter>
                                    <ButtonWrappper>
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
    height: 391px;
`;
const GroupTitle = styled.div`
    font-size:  12px;
    line-height: 16px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    text-transform: uppercase;
`;
const Group = styled.ul`
    display: flex;
    flex-direction: column;
    margin: 0 0 10px 0;
    padding: 0;
`;

const Item = styled.li`
    display: flex;
    flex-direction: row;
    cursor: pointer;
    padding: 10px 0;
    border-radius: 4px;
    :hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
    /* button {
        &:hover {
            display: inline-block;
        }
        display: none;
    } */
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
    align-items: center;;
    font-size:  12px;
    line-height: 16px;
    font-weight: 400;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const ButtonWrappper = styled.div`
    display: inline-block;
    align-self: flex-end;
`;
