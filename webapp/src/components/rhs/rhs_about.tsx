// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {getCurrentChannel, getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {UserProfile} from '@mattermost/types/users';
import {GlobalState} from '@mattermost/types/store';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {setOwner, changeChannelName, updatePlaybookRunDescription} from 'src/client';
import ProfileSelector from 'src/components/profile/profile_selector';
import RHSPostUpdate from 'src/components/rhs/rhs_post_update';
import {useProfilesInCurrentChannel, useProfilesInTeam, useParticipateInRun} from 'src/hooks';
import RHSParticipants from 'src/components/rhs/rhs_participants';
import {HoverMenu} from 'src/components/rhs/rhs_shared';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import RHSAboutButtons from 'src/components/rhs/rhs_about_buttons';
import RHSAboutTitle, {DefaultRenderedTitle} from 'src/components/rhs/rhs_about_title';
import RHSAboutDescription from 'src/components/rhs/rhs_about_description';
import {currentRHSAboutCollapsedState} from 'src/selectors';
import {setRHSAboutCollapsedState, addToCurrentChannel} from 'src/actions';
import {ChannelNamesMap} from 'src/types/backstage';
import {messageHtmlToComponent, formatText} from 'src/webapp_globals';

interface Props {
    playbookRun: PlaybookRun;
    readOnly?: boolean;
    onReadOnlyInteract?: () => void
}

const RHSAbout = (props: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const profilesInChannel = useProfilesInCurrentChannel();
    const collapsed = useSelector(currentRHSAboutCollapsedState);
    const channel = useSelector(getCurrentChannel);
    const profilesInTeam = useProfilesInTeam();

    const myUserId = useSelector(getCurrentUserId);
    const team = useSelector(getCurrentTeam);
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const [showAddToChannel, setShowAddToChannelConfirm] = useState(false);
    const [currentUserSelect, setCurrentUserSelect] = useState<UserProfile | null>();
    const teamnameNameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || '';
    const shouldShowParticipate = myUserId !== props.playbookRun.owner_user_id && props.playbookRun.participant_ids.find((id: string) => id === myUserId) === undefined;
    const overviewURL = `/playbooks/runs/${props.playbookRun.id}?from=channel_rhs_item`;

    const markdownOptions = {
        singleline: true,
        mentionHighlight: true,
        atMentions: true,
        team,
        channelNamesMap,
    };

    const mdText = (text: string) => messageHtmlToComponent(formatText(text, markdownOptions), true, {});

    const toggleCollapsed = () => dispatch(setRHSAboutCollapsedState(channel.id, !collapsed));

    const fetchUsers = async () => {
        return profilesInChannel;
    };

    const fetchUsersInTeam = async () => {
        return profilesInTeam;
    };

    const setOwnerUtil = async (userId?: string) => {
        if (!userId) {
            return;
        }
        const response = await setOwner(props.playbookRun.id, userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
    };

    const onSelectedProfileChange = (userType?: string, user?: UserProfile) => {
        if (!user || !userType) {
            return;
        }

        if (userType === 'Member') {
            setOwnerUtil(user?.id);
        } else {
            setCurrentUserSelect(user);
            setShowAddToChannelConfirm(true);
        }
    };

    const onTitleEdit = (value: string) => {
        changeChannelName(props.playbookRun.channel_id, value);
    };

    const onDescriptionEdit = (value: string) => {
        updatePlaybookRunDescription(props.playbookRun.id, value);
    };

    const [editingSummary, setEditingSummary] = useState(false);
    const editSummary = () => {
        setEditingSummary(true);
    };

    const isFinished = props.playbookRun.current_status === PlaybookRunStatus.Finished;
    const {ParticipateConfirmModal, showParticipateConfirm} = useParticipateInRun(props.playbookRun.id, 'channel_rhs');

    return (
        <>
            <Container
                tabIndex={0}
                id={'rhs-about'}
            >
                <ButtonsRow data-testid='buttons-row'>
                    <RHSAboutButtons
                        playbookRun={props.playbookRun}
                        collapsed={collapsed}
                        toggleCollapsed={toggleCollapsed}
                        editSummary={editSummary}
                        readOnly={props.readOnly}
                    />
                </ButtonsRow>
                <RHSAboutTitle
                    value={props.playbookRun.name}
                    onEdit={onTitleEdit}
                    renderedTitle={RenderedTitle}
                    status={props.playbookRun.current_status}
                />
                {!collapsed &&
                    <>
                        <RHSAboutDescription
                            value={props.playbookRun.summary}
                            onEdit={onDescriptionEdit}
                            editing={editingSummary}
                            setEditing={setEditingSummary}
                            readOnly={props.readOnly}
                            onReadOnlyInteract={props.onReadOnlyInteract}
                        />
                        <Row>
                            <OwnerSection>
                                <MemberSectionTitle>{formatMessage({defaultMessage: 'Owner'})}</MemberSectionTitle>
                                <StyledProfileSelector
                                    testId={'owner-profile-selector'}
                                    selectedUserId={props.playbookRun.owner_user_id}
                                    placeholder={formatMessage({defaultMessage: 'Assign the owner role'})}
                                    placeholderButtonClass={'NoAssignee-button'}
                                    profileButtonClass={'Assigned-button'}
                                    enableEdit={!isFinished && !props.readOnly}
                                    onEditDisabledClick={props.onReadOnlyInteract}
                                    getUsers={fetchUsers}
                                    getUsersInTeam={fetchUsersInTeam}
                                    onSelectedChange={onSelectedProfileChange}
                                    selfIsFirstOption={true}
                                />
                            </OwnerSection>
                            <ParticipantsSection>
                                <MemberSectionTitle>{formatMessage({defaultMessage: 'Participants'})}</MemberSectionTitle>
                                <RHSParticipants
                                    userIds={props.playbookRun.participant_ids.filter((id) => id !== props.playbookRun.owner_user_id)}
                                    playbookRunId={props.playbookRun.id}
                                    onParticipate={shouldShowParticipate ? showParticipateConfirm : undefined}
                                />
                            </ParticipantsSection>
                        </Row>
                    </>
                }
                {props.playbookRun.status_update_enabled && (
                    <RHSPostUpdate
                        readOnly={props.readOnly}
                        onReadOnlyInteract={props.onReadOnlyInteract}
                        collapsed={collapsed}
                        playbookRun={props.playbookRun}
                        updatesExist={props.playbookRun.status_posts.length !== 0}
                    />
                )}
            </Container>
            {(currentUserSelect?.id) ? (
                <ConfirmModal
                    show={showAddToChannel}
                    title={mdText(formatMessage({defaultMessage: 'Add @{displayName} to Channel'}, {displayName: displayUsername(currentUserSelect, teamnameNameDisplaySetting)}))}
                    message={mdText(formatMessage({defaultMessage: '@{displayName} is not a member of the [{runName}]({overviewUrl}) channel. Would you like to add them to this channel? They will have access to all of the message history.'}, {displayName: displayUsername(currentUserSelect, teamnameNameDisplaySetting), runName: channel.name, overviewUrl: overviewURL}))}
                    confirmButtonText={formatMessage({defaultMessage: 'Add'})}
                    onConfirm={() => {
                        if (currentUserSelect) {
                            dispatch(addToCurrentChannel(currentUserSelect.id));
                            setShowAddToChannelConfirm(false);
                            setOwnerUtil(currentUserSelect.id);
                        }
                    }
                    }
                    onCancel={() => setShowAddToChannelConfirm(false)}
                />
            ) : null}
            {ParticipateConfirmModal}
        </>
    );
};

const Container = styled.div`
    position: relative;
    z-index: 2;

    margin-top: 3px;
    padding: 16px 12px;

    :hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

const StyledProfileSelector = styled(ProfileSelector)`
    margin-top: 8px;

    .Assigned-button {
        max-width: 100%;
        height: 28px;
        padding: 2px;
        margin-top: 0;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
        border-radius: 100px;

        :hover {
            background: rgba(var(--center-channel-color-rgb), 0.16);
        }

        .image {
            width: 24px;
            height: 24px;
        }
    }
`;

const ButtonsRow = styled(HoverMenu)`
    top: 9px;
    right: 12px;

    display: none;

    ${Container}:hover & {
        display: block;
    }
`;

const RenderedTitle = styled(DefaultRenderedTitle)`
    ${Container}:hover & {
        max-width: calc(100% - 75px);
    }
`;

const Row = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;

    padding: 0 8px;
    margin-bottom: 30px;
`;

const MemberSection = styled.div`
    :not(:first-child) {
        margin-left: 36px;
    }
`;

const OwnerSection = styled(MemberSection)`
    max-width: calc(100% - 210px);
`;

const ParticipantsSection = styled(MemberSection)`
`;

const ParticipantsContainer = styled.div`
    display: flex;
    flex-direction: row;
`;

const MemberSectionTitle = styled.div`
    font-weight: 600;
    font-size: 12px;
    line-height: 16px;

    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

export default RHSAbout;
