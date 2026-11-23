// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {ApolloProvider} from '@apollo/client';
import {throttle} from 'lodash';
import styled from 'styled-components';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {navigateToPluginUrl} from 'src/browser_routing';
import LoadingSpinner from 'src/components/assets/loading_spinner';
import {TertiaryButton} from 'src/components/assets/buttons';
import {ToastProvider, useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import {ButtonsFormat} from 'src/components/checklist_item/checklist_item';
import RHSChecklistList, {ChecklistParent} from 'src/components/rhs/rhs_checklist_list';
import {getPlaybooksGraphQLClient} from 'src/graphql_client';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {useParticipateInRun} from 'src/hooks';
import {useAppSelector} from 'src/hooks/redux';
import {RunPermissionFields, useCanModifyRun} from 'src/hooks/run_permissions';
import {PlaybookRunStatus} from 'src/types/playbook_run';

import EmbeddedChecklistHeader from './embedded_checklist_header';
import EmbeddedErrorBoundary from './embedded_error_boundary';
import {suppressAutoOpen} from './embedded_run_registry';
import {useEmbeddedRun} from './use_embedded_run';

export const COMPACT_BREAKPOINT_PX = 600;
const READ_ONLY_TOAST_MS = 4500;

export type EmbeddedChecklistProps = {

    /** Run to show. The host binds it; it must not come from user input. */
    runId: string;

    /** When set, the run must belong to this channel or the embed shows the unavailable state. */
    channelId?: string;

    /** true uses the narrow layout, false the wide one, undefined follows the container width. */
    compact?: boolean;

    /** Replaces the default navigation to the run in Playbooks. */
    onOpenInPlaybooks?: () => void;
};

function useContainerCompact(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
    const [compact, setCompact] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!enabled || !element) {
            return undefined;
        }

        const update = (width: number) => setCompact(width < COMPACT_BREAKPOINT_PX);
        update(element.getBoundingClientRect().width);

        if (typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        const observer = new ResizeObserver((entries) => {
            const entry = entries[entries.length - 1];
            if (entry) {
                update(entry.contentRect.width);
            }
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, enabled]);

    return compact;
}

const EmbeddedChecklistBody = ({runId, channelId, compact, onOpenInPlaybooks}: EmbeddedChecklistProps) => {
    const {formatMessage} = useIntl();
    const rootRef = useRef<HTMLDivElement>(null);
    const toaster = useToaster();
    const currentUserId = useAppSelector(getCurrentUserId);
    const {run, status, retry} = useEmbeddedRun(runId);

    const measuredCompact = useContainerCompact(rootRef, compact === undefined);
    const isCompact = compact ?? measuredCompact;

    const channelMismatch = Boolean(run && channelId && run.channel_id !== channelId);
    const runChannelId = run && !channelMismatch ? run.channel_id : undefined;

    useEffect(() => {
        if (!runChannelId) {
            return undefined;
        }
        return suppressAutoOpen(runChannelId);
    }, [runChannelId]);

    const runForPermissions: RunPermissionFields | null = run ? {
        type: run.type,
        channel_id: run.channel_id,
        team_id: run.team_id,
        owner_user_id: run.owner_user_id,
        participant_ids: run.participant_ids,
        current_status: run.current_status,
    } : null;
    const canModify = useCanModifyRun(runForPermissions, currentUserId);

    const {ParticipateConfirmModal, showParticipateConfirm} = useParticipateInRun(run);
    const isPlaybookRun = run?.type === PlaybookRunType.Playbook;
    const inProgress = run?.current_status === PlaybookRunStatus.InProgress;

    const onReadOnlyInteract = useMemo(() => throttle(() => {
        let toastId = -1;
        toastId = toaster.add({
            content: formatMessage({defaultMessage: 'Become a participant to interact with this run'}),
            toastStyle: ToastStyle.Informational,
            buttonName: formatMessage({defaultMessage: 'Participate'}),
            buttonCallback: () => {
                toaster.remove(toastId);
                showParticipateConfirm();
            },
            iconName: 'account-plus-outline',
            duration: READ_ONLY_TOAST_MS,
        });
    }, READ_ONLY_TOAST_MS, {leading: true, trailing: false}), [toaster, formatMessage, showParticipateConfirm]);

    const openInPlaybooks = onOpenInPlaybooks ?? (() => navigateToPluginUrl(`/runs/${runId}`));

    let content: React.ReactNode;
    if (!runId) {
        return null;
    }
    if (status === 'unavailable' || channelMismatch) {
        content = (
            <Message data-testid='embedded-checklist-unavailable'>
                <FormattedMessage defaultMessage="This checklist isn't available. It may have been deleted, or you may not have access."/>
            </Message>
        );
    } else if (status === 'error') {
        content = (
            <Message data-testid='embedded-checklist-error'>
                <FormattedMessage defaultMessage="Couldn't load the checklist."/>
                <TertiaryButton
                    size='sm'
                    onClick={retry}
                    data-testid='embedded-checklist-retry'
                >
                    <FormattedMessage defaultMessage='Retry'/>
                </TertiaryButton>
            </Message>
        );
    } else if (run) {
        const readOnly = !canModify;
        let buttonsFormat = ButtonsFormat.Long;
        if (isCompact) {
            buttonsFormat = ButtonsFormat.Short;
        } else if (readOnly) {
            buttonsFormat = ButtonsFormat.Mixed;
        }

        content = (
            <>
                <EmbeddedChecklistHeader
                    run={run}
                    onOpenInPlaybooks={openInPlaybooks}
                />
                <Scroller>
                    <RHSChecklistList
                        playbookRun={run}
                        parentContainer={ChecklistParent.Embedded}
                        readOnly={readOnly}
                        buttonsFormat={buttonsFormat}
                        onReadOnlyInteract={isPlaybookRun && inProgress ? onReadOnlyInteract : undefined}
                    />
                </Scroller>
                {isPlaybookRun && ParticipateConfirmModal}
            </>
        );
    } else {
        content = (
            <Message data-testid='embedded-checklist-loading'>
                <LoadingSpinner/>
            </Message>
        );
    }

    return (
        <Root
            ref={rootRef}
            className='playbooks-embedded-checklist'
            data-testid='embedded-checklist'
            data-compact={isCompact}
        >
            {content}
        </Root>
    );
};

const EmbeddedChecklist = (props: EmbeddedChecklistProps) => {
    const fallback = (
        <Message data-testid='embedded-checklist-crashed'>
            <FormattedMessage defaultMessage="The checklist couldn't be shown here."/>
            {props.runId && (
                <TertiaryButton
                    size='sm'
                    onClick={props.onOpenInPlaybooks ?? (() => navigateToPluginUrl(`/runs/${props.runId}`))}
                >
                    <FormattedMessage defaultMessage='Open in Playbooks'/>
                </TertiaryButton>
            )}
        </Message>
    );

    return (
        <EmbeddedErrorBoundary fallback={fallback}>
            <ApolloProvider client={getPlaybooksGraphQLClient()}>
                <ToastProvider>
                    <EmbeddedChecklistBody {...props}/>
                </ToastProvider>
            </ApolloProvider>
        </EmbeddedErrorBoundary>
    );
};

export default EmbeddedChecklist;

const Root = styled.div`
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex: 1;
    flex-direction: column;
`;

const Scroller = styled.div`
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    overflow-y: auto;
`;

const Message = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    gap: 8px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
    text-align: center;
`;
