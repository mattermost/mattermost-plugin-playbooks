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

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {SettingsOutlineIcon} from '@mattermost/compass-icons/components';

import {useAppSelector} from 'src/hooks/redux';

import MarkdownEdit from 'src/components/markdown_edit';
import ChecklistList from 'src/components/checklist/checklist_list';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import PlaybookActionsModal from 'src/components/playbook_actions_modal';
import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';
import {savePlaybook} from 'src/client';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import {useAllowRetrospectiveAccess} from 'src/hooks';
import {PlaybookRole} from 'src/types/permissions';
import {PlaybookWithChecklist} from 'src/types/playbook';
import OwnerGroupOnlyActionsToggle from 'src/components/backstage/playbook_editor/owner_group_only_actions_toggle';
import {Section as BaseSection, SectionTitle} from 'src/components/backstage/playbook_edit/styles';

import StatusUpdates from './section_status_updates';
import Retrospective from './section_retrospective';
import Actions from './section_actions';
import ScrollNavBase from './scroll_nav';
import Section from './section';

interface Props {
    playbook: Loaded<FullPlaybook>;
    refetch: () => void;
    restPlaybook?: PlaybookWithChecklist;
}

type StyledAttrs = {className?: string};

type RestOnlyOverrides = Pick<PlaybookWithChecklist, 'owner_group_only_actions'>;

const Outline = ({playbook, refetch, restPlaybook}: Props) => {
    const {formatMessage} = useIntl();
    const updatePlaybook = useUpdatePlaybook(playbook.id);
    const retrospectiveAccess = useAllowRetrospectiveAccess();
    const toaster = useToaster();
    const archived = playbook.delete_at !== 0;
    const currentUserId = useAppSelector(getCurrentUserId);
    const currentMember = playbook.members.find((m) => m.user_id === currentUserId);
    const isPlaybookAdmin = currentMember?.scheme_roles?.includes(PlaybookRole.Admin) ?? false;
    const [restOverrides, setRestOverrides] = useState<Partial<RestOnlyOverrides>>({});
    const [isSavingOwnerGroupOnlyActions, setIsSavingOwnerGroupOnlyActions] = useState(false);
    const effectiveRestPlaybook = restPlaybook ? {...restPlaybook, ...restOverrides} : restPlaybook;
    const [checklistCollapseState, setChecklistCollapseState] = useState<Record<number, boolean>>({});

    const onChecklistCollapsedStateChange = (checklistIndex: number, state: boolean) => {
        setChecklistCollapseState({
            ...checklistCollapseState,
            [checklistIndex]: state,
        });
    };
    const onEveryChecklistCollapsedStateChange = (state: Record<number, boolean>) => {
        setChecklistCollapseState(state);
    };

    const toggleStatusUpdate = () => {
        if (archived) {
            return;
        }
        updatePlaybook({
            statusUpdateEnabled: !playbook.status_update_enabled,
            webhookOnStatusUpdateEnabled: !playbook.status_update_enabled,
            broadcastEnabled: !playbook.status_update_enabled,
        });
    };

    const toggleRetrospective = () => {
        if (archived || !retrospectiveAccess) {
            return;
        }
        updatePlaybook({
            retrospectiveEnabled: !playbook.retrospective_enabled,
        });
    };

    const handleOwnerGroupOnlyActionsChange = useCallback(async (updated: {owner_group_only_actions: boolean}) => {
        if (archived || !restPlaybook || isSavingOwnerGroupOnlyActions) {
            return;
        }
        const prev = effectiveRestPlaybook!.owner_group_only_actions;
        setIsSavingOwnerGroupOnlyActions(true);
        setRestOverrides((o) => ({...o, owner_group_only_actions: updated.owner_group_only_actions}));
        try {
            await savePlaybook({...restPlaybook, owner_group_only_actions: updated.owner_group_only_actions});
        } catch {
            setRestOverrides((o) => ({...o, owner_group_only_actions: prev}));
            toaster.add({
                content: formatMessage({defaultMessage: 'Failed to save setting. Please try again.'}),
                toastStyle: ToastStyle.Failure,
            });
        } finally {
            setIsSavingOwnerGroupOnlyActions(false);
        }
    }, [archived, restPlaybook, isSavingOwnerGroupOnlyActions, effectiveRestPlaybook, toaster, formatMessage]);

    return (
        <Sections
            data-testid='preview-content'
        >
            <Section
                id={'summary'}
                title={formatMessage({defaultMessage: 'Summary'})}
            >
                <MarkdownEdit
                    disabled={archived}
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
                            disabled={archived}
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
                    isReadOnly={false}
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
                            disabled={archived || !retrospectiveAccess}
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
            {isPlaybookAdmin && effectiveRestPlaybook && (
                <Section
                    id={'settings'}
                    title={''}
                >
                    <StyledSettingsSection>
                        <StyledSettingsSectionTitle>
                            <SettingsOutlineIcon size={22}/>
                            {formatMessage({defaultMessage: 'Settings'})}
                        </StyledSettingsSectionTitle>
                        <SettingsRow data-testid='owner-group-only-actions-toggle'>
                            <OwnerGroupOnlyActionsToggle
                                playbook={effectiveRestPlaybook}
                                isPlaybookAdmin={isPlaybookAdmin}
                                disabled={archived || isSavingOwnerGroupOnlyActions}
                                onChange={handleOwnerGroupOnlyActionsChange}
                            />
                        </SettingsRow>
                    </StyledSettingsSection>
                </Section>
            )}
            <PlaybookActionsModal
                playbook={playbook}
                readOnly={false}
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
