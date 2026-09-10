// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';
import {ChevronDownIcon, ChevronUpIcon} from '@mattermost/compass-icons/components';

import {UserProfile} from '@mattermost/types/users';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {useAppDispatch, useAppSelector} from 'src/hooks/redux';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {fetchPlaybookRun, setOwner} from 'src/client';
import ProfileSelector from 'src/components/profile/profile_selector';
import RHSPostUpdate from 'src/components/rhs/rhs_post_update';

import {
    useEnsureProfiles,
    useFavoriteRun,
    useParticipateInRun,
    useProfilesForRun,
    useRunFollowers,
    useRunMetadata,
} from 'src/hooks';
import {useIsSystemAdmin} from 'src/hooks/permissions';
import RHSParticipants from 'src/components/rhs/rhs_participants';
import RHSAboutTitle from 'src/components/rhs/rhs_about_title';
import RHSAboutDescription from 'src/components/rhs/rhs_about_description';
import PropertiesList from 'src/components/rhs/properties_list';
import {currentRHSAboutCollapsedState} from 'src/selectors';
import {playbookRunUpdated, setRHSAboutCollapsedState} from 'src/actions';
import {useUpdateRun} from 'src/graphql/hooks';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

interface Props {
    playbookRun: PlaybookRun;
    readOnly?: boolean;
    onReadOnlyInteract?: () => void
    setShowParticipants: React.Dispatch<React.SetStateAction<boolean>>
    ownerGroupOnlyActions?: boolean;
    isPlaybookAdmin?: boolean;
}

const RHSAbout = (props: Props) => {
    const dispatch = useAppDispatch();
    const {formatMessage} = useIntl();
    const collapsedFromStore = useAppSelector(currentRHSAboutCollapsedState(props.playbookRun.id));
    const profiles = useProfilesForRun(props.playbookRun.team_id, props.playbookRun.channel_id);
    const updateRun = useUpdateRun(props.playbookRun.id);
    const toaster = useToaster();

    const myUserId = useAppSelector(getCurrentUserId);
    const isFinished = props.playbookRun.current_status === PlaybookRunStatus.Finished;
    const isOwner = props.playbookRun.owner_user_id === myUserId;
    const isSystemAdmin = useIsSystemAdmin();
    const isPlaybookAdmin = props.isPlaybookAdmin ?? false;
    const canChangeOwner = props.ownerGroupOnlyActions === false || isOwner || isSystemAdmin || isPlaybookAdmin;

    // System admins and playbook admins may need to hand off ownership even when they
    // are not participants, so the readOnly gate is bypassed for them here.
    const isReadOnlyOverridden = isSystemAdmin || isPlaybookAdmin;
    const canEditOwner = !isFinished && canChangeOwner && (!props.readOnly || isReadOnlyOverridden);
    const shouldShowParticipate = myUserId !== props.playbookRun.owner_user_id && props.playbookRun.participant_ids.find((id: string) => id === myUserId) === undefined;

    // Hooks for favorite and follow state
    const [isFavoriteRun, toggleFavorite] = useFavoriteRun(props.playbookRun.team_id, props.playbookRun.id);
    const [metadata] = useRunMetadata(props.playbookRun.id);
    const followState = useRunFollowers(metadata?.followers || []);
    const isFollowing = followState.isFollowing;
    const hasPermanentViewerAccess = followState.isFollowing || props.playbookRun.participant_ids.includes(myUserId);

    // Determine if collapsed state has been explicitly set
    // Channel checklists should be collapsed by default, runs should be expanded
    const isChannelChecklist = props.playbookRun.type === PlaybookRunType.ChannelChecklist;
    const collapsed = collapsedFromStore ?? (isChannelChecklist);

    const toggleCollapsed = () => {
        dispatch(setRHSAboutCollapsedState(props.playbookRun.id, !collapsed));
    };
    const fetchUsersInTeam = async () => {
        return profiles;
    };

    const setOwnerUtil = async (userId?: string) => {
        if (!userId) {
            return;
        }
        const response = await setOwner(props.playbookRun.id, userId);
        if (response.error) {
            // eslint-disable-next-line no-warning-comments
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
            // Re-fetch to correct stale ownership in Redux — this causes the Finish button
            // to disappear for users who no longer have permission to finish the run.
            fetchPlaybookRun(props.playbookRun.id)
                .then((run) => dispatch(playbookRunUpdated(run)))
                .catch(() => undefined);
            return;
        }

        // Fetch the updated run and push it to Redux so the UI reflects the
        // new owner (and re-resolved checklist assignees) immediately, without
        // waiting for the WebSocket event to arrive.
        try {
            const updatedRun = await fetchPlaybookRun(props.playbookRun.id);
            dispatch(playbookRunUpdated(updatedRun));
        } catch {
            // Non-fatal: the WebSocket event will update the UI shortly.
        }
    };

    const onSelectedProfileChange = (user?: UserProfile) => {
        if (!user) {
            return;
        }
        setOwnerUtil(user?.id);
    };

    // When the owner picker is disabled because OwnerGroupOnlyActions blocks this user,
    // show a toast explaining why — matches the disabled-with-tooltip pattern used by the
    // FinishRun/RestoreRun menu items for the same restriction.
    let onOwnerEditDisabledClick: (() => void) | undefined;
    if (canChangeOwner) {
        onOwnerEditDisabledClick = props.readOnly ? props.onReadOnlyInteract : undefined;
    } else {
        onOwnerEditDisabledClick = () => {
            toaster.add({
                content: formatMessage({defaultMessage: 'Only the run owner can reassign ownership of this run.'}),
                toastStyle: ToastStyle.Failure,
            });
        };
    }

    const onTitleEdit = (value: string) => {
        updateRun({name: value});
    };

    const onDescriptionEdit = (value: string) => {
        updateRun({summary: value});
    };

    const [editingSummary, setEditingSummary] = useState(false);

    const {ParticipateConfirmModal, showParticipateConfirm} = useParticipateInRun(props.playbookRun);
    useEnsureProfiles(props.playbookRun.participant_ids);

    return (
        <>
            <Container
                tabIndex={0}
                id={'rhs-about'}
            >
                <RHSAboutTitle
                    playbookRun={props.playbookRun}
                    onEdit={onTitleEdit}
                    isFavoriteRun={isFavoriteRun}
                    isFollowing={isFollowing}
                    hasPermanentViewerAccess={hasPermanentViewerAccess}
                    toggleFavorite={toggleFavorite}
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
                                    enableEdit={canEditOwner}
                                    onEditDisabledClick={onOwnerEditDisabledClick}
                                    getAllUsers={fetchUsersInTeam}
                                    onSelectedChange={onSelectedProfileChange}
                                    selfIsFirstOption={true}
                                    userGroups={{
                                        subsetUserIds: props.playbookRun.participant_ids,
                                        defaultLabel: formatMessage({defaultMessage: 'NOT PARTICIPATING'}),
                                        subsetLabel: formatMessage({defaultMessage: 'PARTICIPANTS'}),
                                    }}
                                />
                            </OwnerSection>
                            <ParticipantsSection>
                                <MemberSectionTitle>{formatMessage({defaultMessage: 'Participants'})}</MemberSectionTitle>
                                <RHSParticipants
                                    userIds={props.playbookRun.participant_ids.filter((id) => id !== props.playbookRun.owner_user_id)}
                                    onParticipate={!isFinished && shouldShowParticipate ? showParticipateConfirm : undefined}
                                    setShowParticipants={props.setShowParticipants}
                                    canAddParticipants={!isFinished}
                                />
                            </ParticipantsSection>
                        </Row>
                        <PropertiesList
                            propertyFields={props.playbookRun.property_fields}
                            propertyValues={props.playbookRun.property_values}
                            runID={props.playbookRun.id}
                            readOnly={isFinished || props.readOnly}
                        />
                    </>
                }
                <ShowMoreContainer>
                    <ShowMoreButton onClick={toggleCollapsed}>
                        {collapsed ? <FormattedMessage defaultMessage='Details'/> : <FormattedMessage defaultMessage='Hide details'/>}
                        {collapsed ? <ChevronDownIcon size={14}/> : <ChevronUpIcon size={14}/>}
                    </ShowMoreButton>
                    <ShowMoreLine/>
                </ShowMoreContainer>
                {props.playbookRun.status_update_enabled && props.playbookRun.current_status !== PlaybookRunStatus.Finished && (
                    <PostUpdateSection>
                        <RHSPostUpdate
                            readOnly={props.readOnly}
                            onReadOnlyInteract={props.onReadOnlyInteract}
                            collapsed={collapsed}
                            playbookRun={props.playbookRun}
                            updatesExist={props.playbookRun.status_posts.length !== 0}
                        />
                    </PostUpdateSection>
                )}
            </Container>
            {ParticipateConfirmModal}
        </>
    );
};

const Container = styled.div`
    position: relative;
    z-index: 2;
    padding: 6px 12px 0;
    margin-top: 3px;
`;

const StyledProfileSelector = styled(ProfileSelector)`
    margin-top: 8px;

    .Assigned-button {
        max-width: 100%;
        height: 28px;
        padding: 2px;
        border-radius: 100px;
        margin-top: 0;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.16);
        }

        .image {
            width: 24px;
            height: 24px;
        }
    }
`;

const Row = styled.div`
    display: flex;
    flex-flow: row nowrap;
    padding: 0 8px;
    margin-bottom: 12px;
`;

const MemberSection = styled.div`
    &:not(:first-child) {
        margin-left: 36px;
    }
`;

const OwnerSection = styled(MemberSection)`
    max-width: calc(100% - 210px);
`;

const ParticipantsSection = styled(MemberSection)`/* stylelint-disable no-empty-source */`;

const MemberSectionTitle = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
`;

const PostUpdateSection = styled.div`
    margin-top: 12px;
`;

const ShowMoreContainer = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
`;

const ShowMoreLine = styled.div`
    flex: 1;
    height: 1px;
    background-color: rgba(var(--center-channel-color-rgb), 0.08);
`;

const ShowMoreButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    cursor: pointer;
    transition: all 0.15s ease;

    &:focus {
        outline: none;
    }

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

export default RHSAbout;
