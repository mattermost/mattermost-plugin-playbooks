// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import Profile from 'src/components/profile/profile';
import Tooltip from 'src/components/widgets/tooltip';
import {formatProfileName} from 'src/components/profile/profile_selector';
import {Metadata as PlaybookRunMetadata} from 'src/types/playbook_run';

import {SendMessageButton} from './send_message_button';

interface Props {
    participantsIds: string[];
    playbookRunMetadata: PlaybookRunMetadata | null;
}

export const Participants = ({participantsIds, playbookRunMetadata}: Props) => {
    const {formatMessage} = useIntl();

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
                        {num: participantsIds.length}
                    )}
                </ParticipantsNumber>
            </SearchSection>
            <ListSection>
                {
                    participantsIds.map((id) => (
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
                                        teamName={playbookRunMetadata?.team_name ?? null}
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
