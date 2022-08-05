// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {useRun, useRunMetadata} from 'src/hooks';
import {currentBackstageRHS} from 'src/selectors';
import Profile from 'src/components/profile/profile';
import Tooltip from 'src/components/widgets/tooltip';
import {formatProfileName} from 'src/components/profile/profile_selector';

import {SendMessageButton} from './send_message_button';

export const RunParticipantsTitle = <FormattedMessage defaultMessage={'Participants'}/>;

const Participants = () => {
    const {formatMessage} = useIntl();
    const RHS = useSelector(currentBackstageRHS);
    const playbookRunId = RHS.resourceId;
    const [run] = useRun(playbookRunId);

    // we must force metadata refetch when participants change (leave&unfollow)
    const [metadata] = useRunMetadata(playbookRunId, [JSON.stringify(run?.participant_ids)]);

    if (!run) {
        return null;
    }

    // const setSearchTerm = (term: string) => {};

    return (
        <Container>
            <SearchSection>
                {/* <StyledSearchInput
                    testId={'search-filter'}
                    default={''}
                    onSearch={setSearchTerm}
                    placeholder={formatMessage({defaultMessage: 'Search'})}
                /> */}
                <ParticipantsNumber>
                    {formatMessage(
                        {defaultMessage: '{num} {num, plural, one {Participant} other {Participants}}'},
                        {num: run.participant_ids.length}
                    )}
                </ParticipantsNumber>
            </SearchSection>
            <ListSection>
                {
                    run.participant_ids.map((id) => (
                        <ProfileWrapper key={id}>
                            <Profile
                                userId={id}
                                nameFormatter={formatProfileName('')}
                                css={`
                                    margin-right: auto;
                                `}
                            />
                            <HoverButtonContainer>
                                <Tooltip
                                    id={`${id}-tooltip`}
                                    shouldUpdatePosition={true}
                                    content={formatMessage({defaultMessage: 'Send message'})}
                                >
                                    <SendMessageButton
                                        userId={id}
                                        teamName={metadata?.team_name ?? null}
                                    />
                                </Tooltip>
                            </HoverButtonContainer>
                        </ProfileWrapper>
                    ))
                }
            </ListSection>
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

const ParticipantsNumber = styled.div`
    color: rgba(var(--sys-center-channel-color-rgb), 0.56);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    text-transform: uppercase;
    margin-top: 16px;
    margin-left: 22px;
`;

const SearchSection = styled.div`
    background-color: var(--center-channel-bg);
    z-index: 2;
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    padding-top: 16px;
    padding-left: 20px;
`;

const ListSection = styled.div`
    display: flex;
    flex-direction: column;
    margin: 8px 4px;
    padding-bottom: 50px;
`;

// const StyledSearchInput = styled(SearchInput)`
//     &&&input {
//         width: 100%;
//     }
// `;

const HoverButtonContainer = styled.div``;

const ProfileWrapper = styled.div`
    display: flex;
    flex-direction: row;
    padding: 5px 16px;
    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        border-radius: 5px;
    }

    ${HoverButtonContainer} {
        opacity: 0;
    }
    :hover,
    :focus-within {
        background: rgba(var(--center-channel-color-rgb), 0.04);
        ${HoverButtonContainer} {
            opacity: 1;
        }
    }
`;

export default Participants;
