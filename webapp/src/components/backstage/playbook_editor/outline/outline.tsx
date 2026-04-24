// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {
    Children,
    ReactNode,
    useCallback,
    useMemo,
    useState,
} from 'react';

import {useIntl} from 'react-intl';

import {SettingsOutlineIcon} from '@mattermost/compass-icons/components';

import MarkdownEdit from 'src/components/markdown_edit';
import ChecklistList from 'src/components/checklist/checklist_list';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import PlaybookActionsModal from 'src/components/playbook_actions_modal';
import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';
import {savePlaybook} from 'src/client';
import {useAllowRetrospectiveAccess} from 'src/hooks';
import {PlaybookWithChecklist} from 'src/types/playbook';
import AdminOnlyEditToggle from 'src/components/backstage/playbook_editor/admin_only_edit_toggle';
import {Section as BaseSection, SectionTitle} from 'src/components/backstage/playbook_edit/styles';

import StatusUpdates from './section_status_updates';
import Retrospective from './section_retrospective';
import Actions from './section_actions';
import ScrollNavBase from './scroll_nav';
import Section from './section';

interface Props {
    playbook: Loaded<FullPlaybook>;
    refetch: () => void;
    canEdit: boolean;
    restPlaybook?: PlaybookWithChecklist;
    showAdminSettings?: boolean;
}

type StyledAttrs = {className?: string};

type RestOnlyOverrides = Pick<PlaybookWithChecklist, 'admin_only_edit'>;

const Outline = ({playbook, refetch, canEdit, restPlaybook, showAdminSettings = false}: Props) => {
    const {formatMessage} = useIntl();
    const updatePlaybook = useUpdatePlaybook(playbook.id);
    const retrospectiveAccess = useAllowRetrospectiveAccess();
    const archived = playbook.delete_at !== 0;
    const [restOverrides, setRestOverrides] = useState<Partial<RestOnlyOverrides>>({});
    const effectiveRestPlaybook = useMemo(
        () => (restPlaybook ? {...restPlaybook, ...restOverrides} : restPlaybook),
        [restPlaybook, restOverrides],
    );
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

    const toggleRetrospective = useCallback(() => {
        if (archived || !canEdit || !retrospectiveAccess) {
            return;
        }
        updatePlaybook({
            retrospectiveEnabled: !playbook.retrospective_enabled,
        });
    }, [archived, canEdit, retrospectiveAccess, updatePlaybook, playbook.retrospective_enabled]);

    const handleAdminOnlyEditChange = useCallback((updated: Partial<{admin_only_edit: boolean}>) => {
        if (!archived && restPlaybook && updated.admin_only_edit !== undefined) {
            const prev = restPlaybook.admin_only_edit;
            setRestOverrides((o) => ({...o, admin_only_edit: updated.admin_only_edit}));
            savePlaybook({...restPlaybook, admin_only_edit: updated.admin_only_edit}).catch(() => {
                setRestOverrides((o) => ({...o, admin_only_edit: prev}));
            });
        }
    }, [archived, restPlaybook]);

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
                        <Toggle
                            disabled={archived || !canEdit || !retrospectiveAccess}
                            isChecked={playbook.retrospective_enabled}
                            onChange={toggleRetrospective}
                        />
                    </HoverMenuContainer>
                )}
                onHeaderClick={toggleRetrospective}
            >
                <Retrospective
                    playbook={playbook}
                    refetch={refetch}
                />
            </Section>
            <Section
                id={'actions'}
                title={formatMessage({defaultMessage: 'Actions'})}
            >
                <Actions
                    playbook={playbook}
                />
            </Section>
            {showAdminSettings && effectiveRestPlaybook && (
                <Section
                    id={'settings'}
                    title={''}
                >
                    <StyledSettingsSection>
                        <StyledSettingsSectionTitle>
                            <SettingsOutlineIcon size={22}/>
                            {formatMessage({defaultMessage: 'Settings'})}
                        </StyledSettingsSectionTitle>
                        <SettingsRow data-testid='admin-only-edit-toggle'>
                            <AdminOnlyEditToggle
                                playbook={effectiveRestPlaybook}
                                onChange={handleAdminOnlyEditChange}
                            />
                        </SettingsRow>
                    </StyledSettingsSection>
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
    ...rest
}: SectionsProps & StyledAttrs & React.HTMLAttributes<HTMLDivElement>) => {
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
            <div
                className={className}
                {...rest}
            >
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

const StyledSettingsSection = styled(BaseSection)`
    padding: 2rem;
    padding-bottom: 0;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
    margin: 0;
`;

const StyledSettingsSectionTitle = styled(SectionTitle)`
    display: flex;
    align-items: center;
    margin: 0 0 24px;
    font-size: 16px;
    font-weight: 600;
    gap: 8px;

    svg {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }
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
