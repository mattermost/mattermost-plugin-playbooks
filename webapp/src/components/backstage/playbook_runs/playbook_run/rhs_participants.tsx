// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import Profile from 'src/components/profile/profile';
import SearchInput from '../../search_input';
import {ButtonIcon} from 'src/components/assets/buttons';
import Tooltip from 'src/components/widgets/tooltip';

interface Props {
    participantsIds: string[];
}

export const Participants = ({participantsIds}: Props) => {
    const {formatMessage} = useIntl();
    const setSearchTerm = (term: string) => {};

    return (
        <Container>
            <SearchSection>
                <StyledSearchInput
                    testId={'search-filter'}
                    default={''}
                    onSearch={setSearchTerm}
                    placeholder={formatMessage({defaultMessage: 'Search'})}
                />
                <ParticipantsNumber>
                    {formatMessage({defaultMessage: '{num} Participants'}, {num: participantsIds.length})}
                </ParticipantsNumber>
            </SearchSection>
            <ListSection>
                {
                    participantsIds.map((id) => {
                        return (
                            <ProfileWrapper key={id}>
                                <StyledProfile
                                    userId={id}
                                />
                                <Tooltip
                                    id={`${id}-tooltip`}
                                    shouldUpdatePosition={true}
                                    content={formatMessage({defaultMessage: 'Send message'})}
                                >
                                    <ButtonIcon
                                        style={{margin: 'auto 0'}}
                                        className={'icon-send'}
                                        onClick={() => {}}
                                    />
                                </Tooltip>
                            </ProfileWrapper>
                        );
                    })
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
`;

const StyledSearchInput = styled(SearchInput)`
    input {
        width: 100% !important;
    }
`;

const ProfileWrapper = styled.div`
    display: flex;
    flex-direction: row;
    padding: 5px 16px;
    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        border-radius: 5px;
    }    
`;

const StyledProfile = styled(Profile)`
    margin-right: auto;
`;