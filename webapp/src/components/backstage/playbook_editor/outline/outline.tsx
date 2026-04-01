// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {
    Children,
    ReactNode,
    useCallback,
    useState,
} from 'react';

import {useIntl} from 'react-intl';

import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import MarkdownEdit from 'src/components/markdown_edit';
import ChecklistList from 'src/components/checklist/checklist_list';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import PlaybookActionsModal from 'src/components/playbook_actions_modal';
import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';
import {useAllowRetrospectiveAccess} from 'src/hooks';
import {PlaybookRole} from 'src/types/permissions';
import RetrospectiveToggle from 'src/components/backstage/playbook_editor/retrospective_toggle';
import NewChannelOnlyToggle from 'src/components/backstage/playbook_editor/new_channel_only_toggle';
import OwnerGroupOnlyActionsToggle from 'src/components/backstage/playbook_editor/owner_group_only_actions_toggle';
import AdminOnlyEditToggle from 'src/components/backstage/playbook_editor/admin_only_edit_toggle';
import AutoArchiveToggle from 'src/components/backstage/playbook_editor/auto_archive_toggle';

import StatusUpdates from './section_status_updates';
import Retrospective from './section_retrospective';
import Actions from './section_actions';
import ScrollNavBase from './scroll_nav';
import Section from './section';

interface Props {
    playbook: Loaded<FullPlaybook>;
    refetch: () => void;
    canEdit: boolean;
}

type StyledAttrs = {className?: string};

const Outline = ({playbook, refetch, canEdit}: Props) => {
    const {formatMessage} = useIntl();
    const updatePlaybook = useUpdatePlaybook(playbook.id);
    const retrospectiveAccess = useAllowRetrospectiveAccess();
    const archived = playbook.delete_at !== 0;
    const currentUserId = useSelector(getCurrentUserId);
    const currentMember = playbook.members.find((m) => m.user_id === currentUserId);
    const isPlaybookAdmin = currentMember?.scheme_roles?.includes(PlaybookRole.Admin) ?? false;
    const [checklistCollapseState, setChecklistCollapseState] = useState<Record<number, boolean>>({});

    const onChecklistCollapsedStateChange = useCallback((checklistIndex: number, state: boolean) => {
        setChecklistCollapseState((prev) => ({
            ...prev,
            [checklistIndex]: state,
        }));
    }, []);
    const onEveryChecklistCollapsedStateChange = useCallback((state: Record<number, boolean>) => {
        setChecklistCollapseState(state);
    }, []);

    const toggleStatusUpdate = useCallback(() => {
        if (archived || !canEdit) {
            return;
        }
        updatePlaybook({
            statusUpdateEnabled: !playbook.status_update_enabled,
            webhookOnStatusUpdateEnabled: !playbook.status_update_enabled,
            broadcastEnabled: !playbook.status_update_enabled,
        });
    }, [archived, canEdit, updatePlaybook, playbook.status_update_enabled]);

    const handleRetrospectiveChange = useCallback((updated: {retrospective_enabled: boolean}) => {
        if (!archived && canEdit) {
            updatePlaybook({
                retrospectiveEnabled: updated.retrospective_enabled,
            });
        }
    }, [archived, canEdit, updatePlaybook]);

    const handleRetrospectiveHeaderClick = useCallback(() => {
        if (!archived && canEdit && retrospectiveAccess) {
            handleRetrospectiveChange({retrospective_enabled: !playbook.retrospective_enabled});
        }
    }, [archived, canEdit, retrospectiveAccess, handleRetrospectiveChange, playbook.retrospective_enabled]);

    const handleAdminOnlyEditChange = useCallback((updated: {admin_only_edit: boolean}) => {
        if (!archived) {
            updatePlaybook({adminOnlyEdit: updated.admin_only_edit});
        }
    }, [archived, updatePlaybook]);

    const handleOwnerGroupOnlyActionsChange = useCallback((updated: {owner_group_only_actions: boolean}) => {
        if (!archived) {
            updatePlaybook({ownerGroupOnlyActions: updated.owner_group_only_actions});
        }
    }, [archived, updatePlaybook]);

    const handleNewChannelOnlyChange = useCallback((updated: {new_channel_only: boolean}) => {
        if (!archived) {
            updatePlaybook({newChannelOnly: updated.new_channel_only});
        }
    }, [archived, updatePlaybook]);

    const handleAutoArchiveChange = useCallback((updated: {auto_archive_channel: boolean}) => {
        if (!archived) {
            updatePlaybook({autoArchiveChannel: updated.auto_archive_channel});
        }
    }, [archived, updatePlaybook]);

    return (
        <Sections
            data-testid='preview-content'
        >
            <Section
                id={'summary'}
                title={formatMessage({defaultMessage: 'Summary'})}
            >
                <MarkdownEdit
                    disabled={archived || !canEdit}
                    placeholder={formatMessage({defaultMessage: 'Add a run summary template…'})}
                    value={(playbook.run_summary_template_enabled && playbook.run_summary_template) || ''}
                    onSave={(runSummaryTemplate) => {
                        updatePlaybook({
                            runSummaryTemplate,
                            runSummaryTemplateEnabled: Boolean(runSummaryTemplate.trim()),
                        });
                    }}
                />
            </Section>
            <Section
                id={'status-updates'}
                title={formatMessage({defaultMessage: 'Status Updates'})}
                hasSubtitle={true}
                hoverEffect={true}
                headerRight={(
                    <HoverMenuContainer data-testid={'status-update-toggle'}>
                        <Toggle
                            disabled={archived || !canEdit}
                            isChecked={playbook.status_update_enabled}
                            onChange={toggleStatusUpdate}
                        />
                    </HoverMenuContainer>
                )}
                onHeaderClick={toggleStatusUpdate}
            >
                <StatusUpdates
                    playbook={playbook}
                    disabled={archived || !canEdit}
                />
            </Section>
            <Section
                id={'checklists'}
                title={formatMessage({defaultMessage: 'Tasks'})}
            >
                <ChecklistList
                    playbook={playbook}
                    isReadOnly={!canEdit}
                    checklistsCollapseState={checklistCollapseState}
                    onChecklistCollapsedStateChange={onChecklistCollapsedStateChange}
                    onEveryChecklistCollapsedStateChange={onEveryChecklistCollapsedStateChange}
                />
            </Section>
            <Section
                id={'retrospective'}
                title={formatMessage({defaultMessage: 'Retrospective'})}
                hasSubtitle={retrospectiveAccess && !playbook.retrospective_enabled}
                hoverEffect={true}
                headerRight={(
                    <HoverMenuContainer>
                        <RetrospectiveToggle
                            playbook={playbook}
                            onChange={handleRetrospectiveChange}
                            disabled={archived || !canEdit || !retrospectiveAccess}
                        />
                    </HoverMenuContainer>
                )}
                onHeaderClick={handleRetrospectiveHeaderClick}
            >
                <Retrospective
                    playbook={playbook}
                    refetch={refetch}
                    disabled={archived || !canEdit}
                />
            </Section>
            <Section
                id={'actions'}
                title={formatMessage({defaultMessage: 'Actions'})}
            >
                <Actions
                    playbook={playbook}
                    disabled={archived || !canEdit}
                />
            </Section>
            {isPlaybookAdmin && (
                <Section
                    id={'settings'}
                    title={formatMessage({defaultMessage: 'Settings'})}
                >
                    <SettingsRow data-testid='admin-only-edit-toggle'>
                        <AdminOnlyEditToggle
                            playbook={playbook}
                            isAdmin={isPlaybookAdmin}
                            disabled={archived}
                            onChange={handleAdminOnlyEditChange}
                        />
                    </SettingsRow>
                    <SettingsRow data-testid='owner-group-only-actions-toggle'>
                        <OwnerGroupOnlyActionsToggle
                            playbook={playbook}
                            isPlaybookAdmin={isPlaybookAdmin}
                            disabled={archived}
                            onChange={handleOwnerGroupOnlyActionsChange}
                        />
                    </SettingsRow>
                    <SettingsRow data-testid='new-channel-only-toggle'>
                        <NewChannelOnlyToggle
                            playbook={playbook}
                            isPlaybookAdmin={isPlaybookAdmin}
                            disabled={archived}
                            onChange={handleNewChannelOnlyChange}
                        />
                    </SettingsRow>
                    <SettingsRow data-testid='auto-archive-channel-toggle'>
                        <AutoArchiveToggle
                            playbook={playbook}
                            disabled={archived}
                            onChange={handleAutoArchiveChange}
                        />
                    </SettingsRow>
                </Section>
            )}
            <PlaybookActionsModal
                playbook={playbook}
                readOnly={!canEdit}
            />
        </Sections>
    );
};

export const ScrollNav = styled(ScrollNavBase)`/* stylelint-disable no-empty-source */`;

type SectionItem = {id: string, title: string};

type SectionsProps = {
    children: ReactNode;
}

const SectionsImpl = ({
    children,
    className,
}: SectionsProps & StyledAttrs) => {
    const items = Children.toArray(children).reduce<Array<SectionItem>>((result, node) => {
        if (
            React.isValidElement(node) &&
            node.props.id &&
            node.props.title &&
            node.props.children
        ) {
            const {id, title} = node.props;
            result.push({id, title});
        }
        return result;
    }, []);

    return (
        <>
            <ScrollNav
                items={items}
            />
            <div className={className}>
                {children}
            </div>
        </>
    );
};

export const Sections = styled(SectionsImpl)`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    padding: 2rem;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 8px;
    margin-bottom: 40px;
    background: var(--center-channel-bg);
    box-shadow: 0 4px 6px rgba(0 0 0 / 0.12);
`;

const SettingsRow = styled.div`
    padding: 8px 0;
`;

const HoverMenuContainer = styled.div`
    position: relative;
    right: 1px;
    display: flex;
    height: 32px;
    align-items: center;
    padding: 0 8px;
`;

export default Outline;
