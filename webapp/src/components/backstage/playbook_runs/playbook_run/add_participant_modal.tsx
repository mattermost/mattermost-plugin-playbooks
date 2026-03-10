// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {Modal} from 'react-bootstrap';
import styled from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {searchProfiles} from 'mattermost-redux/actions/users';
import {UserProfile} from '@mattermost/types/users';
import {Group, GroupSearchParams} from '@mattermost/types/groups';
import {LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';
import {OptionTypeBase, StylesConfig} from 'react-select';
import {General} from 'mattermost-redux/constants';
import {Client4} from 'mattermost-redux/client';
import debounce from 'debounce';

import GenericModal from 'src/components/widgets/generic_modal';
import {PlaybookRun} from 'src/types/playbook_run';
import {useManageRunMembership} from 'src/graphql/hooks';

import CheckboxInput from 'src/components/backstage/runs_list/checkbox_input';

import {isCurrentUserChannelMember} from 'src/selectors';

import ProfileAutocomplete from 'src/components/backstage/profile_autocomplete';

import {useChannel} from 'src/hooks';

interface Props {
    playbookRun: PlaybookRun;
    id: string;
    title: React.ReactNode;
    show: boolean;
    hideModal: () => void;
}

const AddParticipantsModal = ({playbookRun, id, title, show, hideModal}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<Group[]>([]);
    const [groupSearchTerm, setGroupSearchTerm] = useState('');
    const [debouncedGroupSearchTerm, setDebouncedGroupSearchTerm] = useState('');
    const debouncedSetGroupSearchTerm = useMemo(() => debounce(setDebouncedGroupSearchTerm, 300), []);
    const [groupSearchResults, setGroupSearchResults] = useState<Group[]>([]);
    const {addToRun} = useManageRunMembership(playbookRun.id);
    const [forceAddToChannel, setForceAddToChannel] = useState(false);
    const [channel, meta] = useChannel(playbookRun.channel_id);
    const isChannelMember = useSelector(isCurrentUserChannelMember(playbookRun.channel_id));
    const isPrivateChannelWithAccess = meta.error === null && channel?.type === General.PRIVATE_CHANNEL;

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: playbookRun.team_id}));
    };

    useEffect(() => {
        const searchGroups = async () => {
            try {
                const groups = await Client4.searchGroups({
                    q: debouncedGroupSearchTerm,
                    filter_allow_reference: true,
                    page: 0,
                    per_page: 20,
                    include_member_count: true,
                } as GroupSearchParams);
                setGroupSearchResults(groups || []);
            } catch {
                setGroupSearchResults([]);
            }
        };

        if (show) {
            searchGroups();
        }
    }, [debouncedGroupSearchTerm, show]);

    const handleAddGroup = useCallback((group: Group) => {
        if (!selectedGroups.find((g) => g.id === group.id)) {
            setSelectedGroups((prev) => [...prev, group]);
        }
    }, [selectedGroups]);

    const handleRemoveGroup = useCallback((groupId: string) => {
        setSelectedGroups((prev) => prev.filter((g) => g.id !== groupId));
    }, []);

    const header = (
        <Header>
            {title}
        </Header>
    );

    const renderFooter = () => {
        if (playbookRun.create_channel_member_on_new_participant) {
            return (
                <FooterExtraInfoContainer>
                    <LightningBoltOutlineIcon
                        size={18}
                        color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                    />
                    <FooterText>
                        {formatMessage({defaultMessage: 'Participants will also be added to the channel linked to this run'})}
                    </FooterText>
                </FooterExtraInfoContainer>
            );
        }
        if (isChannelMember || isPrivateChannelWithAccess) {
            return (
                <StyledCheckboxInput
                    testId={'also-add-to-channel'}
                    text={formatMessage({defaultMessage: 'Also add people to the channel linked to this run'})}
                    checked={forceAddToChannel}
                    onChange={(checked) => setForceAddToChannel(checked)}
                />
            );
        }
        return null;
    };

    const onConfirm = () => {
        const userIds = profiles.map((e) => e.id);
        const groupIds = selectedGroups.map((g) => g.id);
        addToRun(userIds, forceAddToChannel, groupIds);
        hideModal();
    };

    const hasSelections = (profiles && profiles.length > 0) || selectedGroups.length > 0;

    return (
        <GenericModal
            id={id}
            modalHeaderText={header}
            show={show}
            onHide={hideModal}

            confirmButtonText={formatMessage({defaultMessage: 'Add'})}
            handleConfirm={onConfirm}
            isConfirmDisabled={!hasSelections}

            onExited={() => {
                setProfiles([]);
                setSelectedGroups([]);
                setForceAddToChannel(false);
                setGroupSearchTerm('');
                setDebouncedGroupSearchTerm('');
            }}

            isConfirmDestructive={false}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={false}
            enforceFocus={true}
            footer={renderFooter()}
            components={{
                Header: ModalHeader,
                FooterContainer: StyledFooterContainer,
            }}
        >
            <SectionLabel>
                <FormattedMessage defaultMessage='People'/>
            </SectionLabel>
            <ProfileAutocomplete
                searchProfiles={searchUsers}
                userIds={[]}
                isDisabled={false}
                isMultiMode={true}
                customSelectStyles={selectStyles}
                setValues={setProfiles}
                placeholder={formatMessage({defaultMessage: 'Search for people'})}
            />
            <SectionLabel>
                <FormattedMessage defaultMessage='Groups'/>
            </SectionLabel>
            <GroupSearchInput
                type='text'
                placeholder={formatMessage({defaultMessage: 'Search for groups'})}
                value={groupSearchTerm}
                onChange={(e) => {
                    setGroupSearchTerm(e.target.value);
                    debouncedSetGroupSearchTerm(e.target.value);
                }}
            />
            {selectedGroups.length > 0 && (
                <SelectedGroupsList>
                    {selectedGroups.map((group) => (
                        <SelectedGroupChip key={group.id}>
                            <i className='icon icon-account-multiple-outline'/>
                            <span>{group.display_name}</span>
                            {group.source === 'ldap' && (
                                <LinkedIcon className='icon icon-link-variant'/>
                            )}
                            {group.member_count !== undefined && (
                                <GroupMemberCount>
                                    <FormattedMessage
                                        defaultMessage='({count})'
                                        values={{count: group.member_count}}
                                    />
                                </GroupMemberCount>
                            )}
                            <RemoveButton onClick={() => handleRemoveGroup(group.id)}>
                                <i className='icon icon-close'/>
                            </RemoveButton>
                        </SelectedGroupChip>
                    ))}
                </SelectedGroupsList>
            )}
            {groupSearchResults.length > 0 && (
                <GroupResultsList>
                    {groupSearchResults
                        .filter((g) => !selectedGroups.find((sg) => sg.id === g.id))
                        .map((group) => (
                            <GroupResultItem
                                key={group.id}
                                onClick={() => handleAddGroup(group)}
                            >
                                <i className='icon icon-account-multiple-outline'/>
                                <GroupResultName>{group.display_name}</GroupResultName>
                                {group.source === 'ldap' && (
                                    <LinkedIcon className='icon icon-link-variant'/>
                                )}
                                {group.member_count !== undefined && (
                                    <GroupResultMemberCount>
                                        <FormattedMessage
                                            defaultMessage='{count} {count, plural, one {member} other {members}}'
                                            values={{count: group.member_count}}
                                        />
                                    </GroupResultMemberCount>
                                )}
                            </GroupResultItem>
                        ))
                    }
                </GroupResultsList>
            )}
        </GenericModal>
    );
};

const ModalHeader = styled(Modal.Header)`
    &&&& {
        margin-bottom: 16px;
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
`;

const SectionLabel = styled.div`
    margin-top: 16px;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    text-transform: uppercase;
    letter-spacing: 0.02em;

    &:first-of-type {
        margin-top: 0;
    }
`;

const GroupSearchInput = styled.input`
    width: 100%;
    height: 48px;
    padding: 0 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background-color: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 16px;
    outline: none;

    &:focus {
        border-color: var(--button-bg);
        box-shadow: inset 0 0 0 1px var(--button-bg);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const LinkedIcon = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.48);
    font-size: 14px;
    flex-shrink: 0;
`;

const SelectedGroupsList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
`;

const SelectedGroupChip = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 4px 4px 8px;
    border-radius: 16px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    font-size: 14px;
    line-height: 18px;

    .icon {
        color: rgba(var(--center-channel-color-rgb), 0.56);
        font-size: 14px;
    }
`;

const GroupMemberCount = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
`;

const RemoveButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(var(--center-channel-color-rgb), 0.32);
    color: rgba(var(--center-channel-bg-rgb), 0.80);
    cursor: pointer;

    .icon {
        color: inherit;
        font-size: 12px;
    }

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const GroupResultsList = styled.div`
    max-height: 200px;
    margin-top: 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    overflow-y: auto;
`;

const GroupResultItem = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;

    .icon {
        color: rgba(var(--center-channel-color-rgb), 0.56);
        font-size: 16px;
    }

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.04);
    }
`;

const GroupResultName = styled.span`
    font-size: 14px;
    font-weight: 600;
`;

const GroupResultMemberCount = styled.span`
    margin-left: auto;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
`;

const StyledFooterContainer = styled.div`
    display: flex;
    width: 100%;
    flex-direction: row-reverse;
    align-items: center;
`;

const FooterExtraInfoContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-right: auto;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    text-align: left;
`;

const FooterText = styled.span`
    margin-left: 10px;
`;

const StyledCheckboxInput = styled(CheckboxInput)`
    padding: 10px 16px 10px 0;
    margin-right: auto;
    font-weight: normal;
    white-space: normal;

    &:hover {
        background-color: transparent;
    }
`;

const selectStyles: StylesConfig<OptionTypeBase, boolean> = {
    control: (provided, {isDisabled}) => ({
        ...provided,
        backgroundColor: isDisabled ? 'rgba(var(--center-channel-bg-rgb),0.16)' : 'var(--center-channel-bg)',
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
        minHeight: '48px',
        fontSize: '16px',
        '&&:before': {content: 'none'},
    }),
    placeholder: (provided) => ({
        ...provided,
        marginLeft: '8px',
    }),
    input: (provided) => ({
        ...provided,
        marginLeft: '8px',
        color: 'var(--center-channel-color)',
    }),
    multiValue: (provided) => ({
        ...provided,
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
        borderRadius: '16px',
        paddingLeft: '8px',
        overflow: 'hidden',
        height: '32px',
        alignItems: 'center',
    }),
    multiValueLabel: (provided) => ({
        ...provided,
        padding: 0,
        paddingLeft: 0,
        lineHeight: '18px',
        color: 'var(--center-channel-color)',
    }),
    multiValueRemove: (provided) => ({
        ...provided,
        color: 'rgba(var(--center-channel-bg-rgb), 0.80)',
        backgroundColor: 'rgba(var(--center-channel-color-rgb),0.32)',
        borderRadius: '50%',
        margin: '4px',
        padding: 0,
        cursor: 'pointer',
        width: '16px',
        height: '16px',
        ':hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        ':active': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        '> svg': {
            height: '16px',
            width: '16px',
        },
    }),
};

export default AddParticipantsModal;
