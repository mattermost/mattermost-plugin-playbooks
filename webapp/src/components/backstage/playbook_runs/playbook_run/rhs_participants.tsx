// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {AccountPlusOutlineIcon} from '@mattermost/compass-icons/components';

import Profile from 'src/components/profile/profile';
import Tooltip from 'src/components/widgets/tooltip';
import {formatProfileName} from 'src/components/profile/profile_selector';
import {Metadata as PlaybookRunMetadata} from 'src/types/playbook_run';

import SearchInput from '../../search_input';

import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';

import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';

import {SendMessageButton} from './send_message_button';

interface Props {
    participantsIds: string[];
    runOwnerUserId: string;
    playbookRunMetadata: PlaybookRunMetadata | null;
}

export const Participants = ({participantsIds, runOwnerUserId, playbookRunMetadata}: Props) => {
    const {formatMessage} = useIntl();
    const [manageMode, setManageMode] = useState(false);

    const setSearchTerm = (term: string) => null;

    return (
        <>
            <Container>
                <HeaderSection>
                    <ParticipantsNumber>
                        {formatMessage(
                            {defaultMessage: '{num} {num, plural, one {Participant} other {Participants}}'},
                            {num: participantsIds.length}
                        )}
                    </ParticipantsNumber>

                    {manageMode ? (
                        <StyledPrimaryButton onClick={() => setManageMode(false)}>
                            {formatMessage({defaultMessage: 'Done'})}
                        </StyledPrimaryButton>
                    ) : (
                        <>
                            <StyledSecondaryButton onClick={() => setManageMode(true)}>
                                {formatMessage({defaultMessage: 'Manage'})}
                            </StyledSecondaryButton>

                            <StyledPrimaryButton onClick={() => null}>
                                <AddParticipantIcon color={'var(--button-color)'}/>
                                {formatMessage({defaultMessage: 'Add'})}
                            </StyledPrimaryButton>
                        </>
                    )}
                </HeaderSection>

                <SearchSection>
                    <SearchInput
                        testId={'search-filter'}
                        default={''}
                        onSearch={setSearchTerm}
                        placeholder={formatMessage({defaultMessage: 'Search'})}
                        width={'100%'}
                    />
                </SearchSection>
                <SectionTitle>
                    {formatMessage({defaultMessage: 'Owner'})}
                </SectionTitle>

                <ParticipantLine
                    id={runOwnerUserId}
                    teamName={playbookRunMetadata?.team_name}
                    isRunOwner={true}
                    manageMode={manageMode}
                />

                <SectionTitle>
                    {formatMessage({defaultMessage: 'Participants'})}
                </SectionTitle>
                <ListSection>
                    {
                        participantsIds.map((id: string) => {
                            // skip the owner
                            if (id === runOwnerUserId) {
                                return null;
                            }
                            return (
                                <ParticipantLine
                                    key={id}
                                    id={id}
                                    teamName={playbookRunMetadata?.team_name}
                                    isRunOwner={false}
                                    manageMode={manageMode}
                                />
                            );
                        })
                    }
                </ListSection>
            </Container>
        </>
    );
};

interface ParticipantLineProps {
    id: string;
    teamName: string | undefined;
    isRunOwner: boolean;
    manageMode: boolean;
}

const ParticipantLine = ({id, teamName, isRunOwner, manageMode}: ParticipantLineProps) => {
    const {formatMessage} = useIntl();

    let rightButton = (
        <HoverButtonContainer>
            <Tooltip
                id={`${id}-tooltip`}
                shouldUpdatePosition={true}
                content={formatMessage({defaultMessage: 'Send message'})}
            >
                <SendMessageButton
                    userId={id}
                    teamName={teamName ?? null}
                />
            </Tooltip>
        </HoverButtonContainer>
    );

    if (manageMode) {
        rightButton = (
            <DotMenu
                placement='bottom-end'
                dotMenuButton={ParticipantButton}
                icon={
                    <IconWrapper>
                        {isRunOwner ? formatMessage({defaultMessage: 'Owner'}) : formatMessage({defaultMessage: 'Participant'})}
                        <i className={'icon-chevron-down'}/>
                    </IconWrapper>
                }
            >
                {isRunOwner ? (
                    <DropdownMenuItem
                        onClick={() => null}
                    >
                        {formatMessage({defaultMessage: 'Make run participant'})}
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem
                        onClick={() => null}
                    >
                        {formatMessage({defaultMessage: 'Make run owner'})}
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    onClick={() => null}
                >
                    {formatMessage({defaultMessage: 'Remove from run'})}
                </DropdownMenuItem>
            </DotMenu>
        );
    }

    return (
        <ProfileWrapper key={id}>
            <Profile
                userId={id}
                nameFormatter={formatProfileName('')}
                css={`
                    margin-right: auto;
                `}
            />
            {rightButton}
        </ProfileWrapper>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

const ParticipantsNumber = styled.div`
    color: var(--center-channel-text);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    margin-right: auto;
`;

const SectionTitle = styled.div`
    color: rgba(var(--sys-center-channel-color-rgb), 0.56);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    text-transform: uppercase;
    margin-top: 16px;
    padding: 0 20px;
`;

const SearchSection = styled.div`
    background-color: var(--center-channel-bg);
    z-index: 2;
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    padding: 16px 20px 0 20px;
`;

const ListSection = styled.div`
    display: flex;
    flex-direction: column;
    margin: 8px 4px;
    padding-bottom: 50px;
`;

const HoverButtonContainer = styled.div``;

const ProfileWrapper = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 5px 24px;
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

const HeaderSection = styled.div`
    display: flex;
    flex-direction: row;
    padding: 20px 20px 0 20px;
    color: var(--center-channel-text);
    align-items: center;
`;

const StyledSecondaryButton = styled(TertiaryButton)`
    display: flex;
    align-items: center;
    height: 32px;
    font-size: 12px;
    line-height: 10px;
    margin-right: 8px;    
`;

const StyledPrimaryButton = styled(PrimaryButton)`
    display: flex;
    align-items: center;
    height: 32px;
    font-size: 12px;
    line-height: 10px;
`;

const AddParticipantIcon = styled(AccountPlusOutlineIcon)`
    height: 14.4px;
    width: 14.4px;
    margin-right: 3px;
`;

const ParticipantButton = styled.div`
    display: inline-flex;
    border-radius: 4px;
    fill: var(--link-color);
    height: 25px;
    align-items: center;
    color: var(--link-color);
    &:hover {
       background: rgba(var(--button-bg-rgb), 0.08);
       color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

const IconWrapper = styled.div`
    display: inline-flex;
    padding: 10px 5px 10px 8px;
`;
