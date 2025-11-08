// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import StatusBadge, {BadgeType} from 'src/components/backstage/status_badge';
import {ContextMenu, CONTEXT_MENU_LOCATION} from 'src/components/backstage/playbook_runs/playbook_run/context_menu';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {CancelSaveContainer} from 'src/components/checklist_item/inputs';
import TextEdit from 'src/components/text_edit';
import {SemiBoldHeading} from 'src/styles/headings';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';

interface Props {
    playbookRun: PlaybookRun;
    onEdit: (newTitle: string) => void;
    isFavoriteRun: boolean;
    isFollowing: boolean;
    hasPermanentViewerAccess: boolean;
    toggleFavorite: () => void;
}

const RHSAboutTitle = (props: Props) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);

    // Determine role
    const isParticipant = props.playbookRun.participant_ids.includes(currentUserId);
    const role = isParticipant ? Role.Participant : Role.Viewer;

    return (
        <TitleWrapper>
            <TextEdit
                disabled={props.playbookRun.current_status !== PlaybookRunStatus.InProgress}
                placeholder={formatMessage({defaultMessage: 'Run name'})}
                value={props.playbookRun.name}
                onSave={(name: string) => props.onEdit(name)}
                editStyles={css`
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    width: 100%;

                    input {
                        ${SemiBoldHeading};
                        font-size: 18px;
                        line-height: 24px;
                        color: var(--center-channel-color);
                        height: 30px;
                        width: 100%;
                        padding: 0 8px;
                        border-radius: 5px;
                        border: none;
                        background: rgba(var(--center-channel-color-rgb), 0.04);
                        margin-bottom: 0;
                    }
                    ${CancelSaveContainer} {
                        padding: 0;
                        margin-top: 8px;
                        align-self: flex-end;
                    }
                    ${PrimaryButton}, ${TertiaryButton} {
                        height: 28px;
                    }
                `}
            >
                {(edit: () => void) => (
                    <>
                        <ContextMenu
                            playbookRun={props.playbookRun}
                            role={role}
                            onRenameClick={edit}
                            isFavoriteRun={props.isFavoriteRun}
                            isFollowing={props.isFollowing}
                            toggleFavorite={props.toggleFavorite}
                            hasPermanentViewerAccess={props.hasPermanentViewerAccess}
                            location={CONTEXT_MENU_LOCATION.RHS}
                        />
                        {props.playbookRun.current_status === PlaybookRunStatus.Finished &&
                            <StatusBadgeWrapper status={BadgeType.Finished}/>
                        }
                    </>
                )}
            </TextEdit>
        </TitleWrapper>
    );
};

const TitleWrapper = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: 6px;
`;

const StatusBadgeWrapper = styled(StatusBadge)`
    top: -3px;
    margin-left: 8px;
`;

export default RHSAboutTitle;
