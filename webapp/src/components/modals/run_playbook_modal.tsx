// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    ComponentProps,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {ArrowLeftIcon, CloseIcon} from '@mattermost/compass-icons/components';
import {ApolloProvider} from '@apollo/client';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {getPlaybooksGraphQLClient} from 'src/graphql_client';
import {useCanCreatePlaybooksInTeam, usePlaybook, usePlaybookAttributes} from 'src/hooks';
import {BaseInput, BaseTextArea} from 'src/components/assets/inputs';
import GenericModal, {InlineLabel, ModalSideheading} from 'src/components/widgets/generic_modal';
import {createPlaybookRun} from 'src/client';
import {ButtonLabel, StyledChannelSelector, VerticalSplit} from 'src/components/backstage/playbook_edit/automation/channel_access';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';
import {HorizontalSpacer, RadioInput, StyledSelect} from 'src/components/backstage/styles';
import {displayPlaybookCreateModal} from 'src/actions';
import PlaybooksSelector from 'src/components/playbooks_selector';
import {RUN_NAME_MAX_LENGTH} from 'src/constants';
import Profile from 'src/components/profile/profile';
import ProfileSelector from 'src/components/profile/profile_selector';
import {useProfilesInTeam, useUserDisplayNameMap} from 'src/hooks/general';
import LoadingSpinner from 'src/components/assets/loading_spinner';
import {TemplatePropertyField, buildTemplatePreview, extractTemplateFieldNames} from 'src/utils/template_utils';

const ID = 'playbooks_run_playbook_dialog';

export const makeModalDefinition = (
    playbookId: string | undefined,
    triggerChannelId: string | undefined,
    teamId: string,
    onRunCreated: (runId: string, channelId: string, statsData: object) => void,
) => ({
    modalId: ID,
    dialogType: ApolloWrappedModal,
    dialogProps: {playbookId, triggerChannelId, teamId, onRunCreated},
});

type Props = {
    playbookId?: string,
    triggerChannelId?: string,
    teamId: string,
    onRunCreated: (runId: string, channelId: string, statsData: object) => void,
} & Partial<ComponentProps<typeof GenericModal>>;

export const RunPlaybookModal = ({
    playbookId,
    triggerChannelId,
    teamId,
    onRunCreated,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {onHide, ...restModalProps} = modalProps;

    const [step, setStep] = useState(playbookId === undefined ? 'select-playbook' : 'run-details');
    const [selectedPlaybookId, setSelectedPlaybookId] = useState(playbookId);
    const [playbook, {isFetching: playbookLoading, error: playbookError}] = usePlaybook(selectedPlaybookId || '');
    const playbookAttributes = usePlaybookAttributes(selectedPlaybookId || '');
    const [runName, setRunName] = useState('');
    const [runSummary, setRunSummary] = useState('');
    const [channelMode, setChannelMode] = useState('');
    const [channelId, setChannelId] = useState('');
    const [createPublicRun, setCreatePublicRun] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);
    const isMountedRef = useRef(true);
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    const [submitError, setSubmitError] = useState('');
    const [propertyValues, setPropertyValues] = useState<Record<string, unknown>>({});
    const canCreatePlaybooks = useCanCreatePlaybooksInTeam(teamId || '');

    const currentChannelId = useSelector(getCurrentChannelId);
    const currentUserId = useSelector(getCurrentUserId);
    const userId = (playbook?.default_owner_enabled && playbook.default_owner_id) ? playbook.default_owner_id : currentUserId;

    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting) || '';
    const userMap = useUserDisplayNameMap();

    // pickerUserNames captures display names for users selected via the picker
    // that may not be in the Redux team-profiles slice (found via search API).
    const [pickerUserNames, setPickerUserNames] = useState<Record<string, string>>({});
    const handleUserKnown = useCallback((user: {id: string} & Record<string, unknown>) => {
        const name = displayUsername(user as Parameters<typeof displayUsername>[0], teammateNameDisplaySetting);
        setPickerUserNames((prev) => ({...prev, [user.id]: name}));
    }, [teammateNameDisplaySetting]);
    const effectiveUserMap = useMemo(() => ({...userMap, ...pickerUserNames}), [userMap, pickerUserNames]);

    // Initialize all form fields atomically when the playbook loads for the selected ID.
    // A single effect prevents race conditions between independent effects that could
    // briefly expose stale state from the previous playbook.
    useEffect(() => {
        // Reset form state first; skip isSubmitting if a submission is already in flight
        // to avoid a split-brain where the button looks clickable but isSubmittingRef blocks clicks.
        setPropertyValues({});
        setSubmitError('');
        if (!isSubmittingRef.current) {
            setIsSubmitting(false);
        }

        if (!playbook || playbook.id !== selectedPlaybookId) {
            setRunName('');
            setRunSummary('');
            return;
        }

        // Pre-fill with the channel_name_template so the user can see the raw template.
        // When a template is NOT set the input is required and starts empty.
        setRunName(playbook.channel_name_template ?? '');

        setRunSummary(playbook.run_summary_template_enabled ? playbook.run_summary_template : '');
        setChannelMode(playbook.channel_mode);
        setChannelId(playbook.channel_id);
        setCreatePublicRun(playbook.create_public_playbook_run);
    }, [playbook, selectedPlaybookId]);

    // Determine which property fields the template references
    const templateFieldNames = useMemo(() => {
        const names = new Set<string>();
        if (playbook?.channel_name_template) {
            extractTemplateFieldNames(playbook.channel_name_template).forEach((n) => names.add(n.toLowerCase()));
        }
        return names;
    }, [playbook?.channel_name_template]);

    const templateFields = useMemo(() => {
        if (!playbookAttributes || playbookAttributes.length === 0 || templateFieldNames.size === 0) {
            return [];
        }
        const seen = new Set<string>();
        return playbookAttributes.filter((f) => {
            const lower = f.name.toLowerCase();
            if (templateFieldNames.has(lower) && !seen.has(lower)) {
                seen.add(lower);
                return true;
            }
            return false;
        }) as unknown as TemplatePropertyField[];
    }, [playbookAttributes, templateFieldNames]);

    const hasTemplate = Boolean(playbook?.channel_name_template);

    // Preview the resolved name (client-side approximation)
    const namePreview = useMemo(() => {
        const tpl = playbook?.channel_name_template;
        if (!tpl) {
            return '';
        }
        return buildTemplatePreview(
            tpl,
            (playbookAttributes ?? []) as unknown as TemplatePropertyField[],
            propertyValues,
            {
                prefix: playbook?.run_number_prefix,
                userMap: effectiveUserMap,
                ownerUserId: userId,
                creatorUserId: currentUserId,
                nextRunNumber: playbook?.next_run_number,
                ownerFallback: formatMessage({id: 'playbooks.template_preview.owner_fallback', defaultMessage: "Owner's name"}),
                creatorFallback: formatMessage({id: 'playbooks.template_preview.creator_fallback', defaultMessage: "Creator's name"}),
            },
        );
    }, [playbook?.channel_name_template, playbook?.run_number_prefix, playbookAttributes, playbook?.next_run_number, propertyValues, effectiveUserMap, userId, currentUserId, formatMessage]);

    const createNewChannel = channelMode === 'create_new_channel';

    // Name is required unless the playbook has a name template.
    // In template mode the resolved preview must also fit within the limit so the backend
    // accepts it; the raw template string itself is not validated against the limit.
    const nameValid = hasTemplate ? (namePreview === '' || [...namePreview].length <= RUN_NAME_MAX_LENGTH) : (runName !== '' && [...runName].length <= RUN_NAME_MAX_LENGTH);

    const namePreviewTooLong = hasTemplate && [...namePreview].length > RUN_NAME_MAX_LENGTH;

    // All template-referenced fields must have values
    const requiredFieldsFilled = templateFields.every((field) => {
        const val = propertyValues[field.id];
        if (val === undefined || val === null || val === '') {
            return false;
        }
        if (Array.isArray(val) && val.length === 0) {
            return false;
        }
        return true;
    });

    const isFormValid = nameValid && requiredFieldsFilled && (createNewChannel || channelId !== '');

    const handleSetChannelMode = useCallback((mode: 'link_existing_channel' | 'create_new_channel') => {
        setChannelMode(mode);

        // Default to the current channel when choosing link to the existing channel, we are in a channel context and the playbook does not have a linked channel
        if (mode === 'link_existing_channel' && playbook?.channel_mode === 'create_new_channel' && channelId === '' && currentChannelId) {
            setChannelId(currentChannelId);
        }
    }, [playbook?.channel_mode, channelId, currentChannelId]);

    const onCreatePlaybook = () => {
        dispatch(displayPlaybookCreateModal({}));
        onHide?.();
    };

    const handleSelectPlaybook = useCallback((id: string) => {
        setSelectedPlaybookId(id);
        setStep('run-details');
    }, []);
    const onSubmit = useCallback(() => {
        if (!playbook || !selectedPlaybookId || playbook.id !== selectedPlaybookId || isSubmittingRef.current) {
            return;
        }

        // Re-validate at submission time to guard against stale closures where isFormValid
        // may have been computed during a previous render cycle.
        if (!isFormValid) {
            return;
        }

        const isNewChannel = channelMode === 'create_new_channel';
        const isLinkedChannel = channelMode === 'link_existing_channel';

        // isSubmittingRef (ref) and isSubmitting (state) serve different purposes:
        // - isSubmittingRef provides a synchronous guard to prevent double-submission
        //   (checked before the async call, before any React batching).
        // - isSubmitting drives the UI disabled state; it is set via setState so its
        //   update is batched and applied on the next render paint.
        // Both must be set here so the ref guard fires immediately and the button
        // becomes visually disabled on the next frame.
        isSubmittingRef.current = true;
        setSubmitError('');
        setIsSubmitting(true);
        const pvToSend = Object.keys(propertyValues).length > 0 ? propertyValues : undefined;
        let runPromise: ReturnType<typeof createPlaybookRun>;
        try {
            runPromise = createPlaybookRun(
                selectedPlaybookId,
                userId,
                playbook.team_id,
                runName,
                runSummary,
                isLinkedChannel ? channelId : undefined,
                isNewChannel ? createPublicRun : undefined,
                pvToSend,
            );
        } catch {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            setSubmitError(formatMessage({id: 'playbooks.run_playbook_modal.submit_error', defaultMessage: 'An error occurred while creating the run.'}));
            return;
        }
        runPromise
            .then((newPlaybookRun) => {
                isSubmittingRef.current = false;
                if (!isMountedRef.current) {
                    return;
                }
                setIsSubmitting(false);
                const statsData = {
                    playbookId: selectedPlaybookId,
                    channelMode,
                    public: isNewChannel ? createPublicRun : undefined,
                    hasPlaybookChanged: playbookId !== selectedPlaybookId,
                    hasNameChanged: playbook.channel_name_template ? false : runName !== '',
                    hasSummaryChanged: runSummary !== (playbook.run_summary_template_enabled ? playbook.run_summary_template : ''),
                    hasChannelModeChanged: channelMode !== playbook.channel_mode,
                    hasChannelIdChanged: channelId !== playbook.channel_id,
                    hasPublicChanged: !isLinkedChannel && createPublicRun !== playbook.create_public_playbook_run,
                };
                onRunCreated(newPlaybookRun.id, newPlaybookRun.channel_id, statsData);
                onHide?.();
            }).catch(() => {
                isSubmittingRef.current = false;
                if (!isMountedRef.current) {
                    return;
                }
                setSubmitError(formatMessage({id: 'playbooks.run_playbook_modal.submit_error', defaultMessage: 'An error occurred while creating the run.'}));
                setIsSubmitting(false);
            });
    }, [playbook, selectedPlaybookId, isFormValid, propertyValues, userId, runName, runSummary, channelId, createPublicRun, channelMode, playbookId, onHide, onRunCreated, formatMessage]);

    // Start a run tab
    if (step === 'run-details') {
        if (selectedPlaybookId && playbookLoading && !submitError) {
            return (
                <StyledGenericModal
                    id={ID}
                    showCancel={false}
                    onHide={onHide}
                    {...restModalProps}
                >
                    <LoadingContainer
                        role='status'
                        aria-label={formatMessage({id: 'playbooks.run_playbook_modal.loading', defaultMessage: 'Loading playbook details…'})}
                    >
                        <LoadingSpinner/>
                    </LoadingContainer>
                </StyledGenericModal>
            );
        }
        if (selectedPlaybookId && playbookError && !playbook) {
            return (
                <StyledGenericModal
                    id={ID}
                    showCancel={false}
                    onHide={onHide}
                    {...restModalProps}
                >
                    <ErrorMessage role='alert'>
                        {formatMessage({id: 'playbooks.run_playbook_modal.load_error', defaultMessage: 'Failed to load playbook details. Please close and try again.'})}
                    </ErrorMessage>
                </StyledGenericModal>
            );
        }
        return (
            <StyledGenericModal
                cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
                confirmButtonText={formatMessage({defaultMessage: 'Start run'})}
                showCancel={true}
                isConfirmDisabled={isSubmitting || !isFormValid}
                handleConfirm={onSubmit}
                autoCloseOnConfirmButton={false}
                enforceFocus={false}
                id={ID}
                modalHeaderText={(
                    <ColContainer>
                        <IconWrapper
                            type='button'
                            aria-label={formatMessage({defaultMessage: 'Back'})}
                            onClick={() => {
                                setSearchTerm('');
                                setStep('select-playbook');
                            }}
                        >
                            <ArrowLeftIcon
                                size={24}
                                color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                            />
                        </IconWrapper>
                        <HeaderTitle>
                            <FormattedMessage defaultMessage='Run playbook'/>
                            <ModalSideheading>{playbook?.title}</ModalSideheading>
                        </HeaderTitle>
                    </ColContainer>
                )}
                onHide={onHide}
                {...restModalProps}
            >
                <Body>
                    <RunNameSection
                        runName={runName}
                        onSetRunName={setRunName}
                        readOnly={hasTemplate}
                    />
                    {hasTemplate && namePreview && (
                        <NamePreview data-testid='run-name-preview'>
                            {formatMessage({id: 'playbooks.run_playbook_modal.name_preview', defaultMessage: 'Preview: {preview}'}, {preview: namePreview})}
                        </NamePreview>
                    )}
                    {namePreviewTooLong && (
                        <ErrorMessage data-testid='run-name-preview-error'>
                            {formatMessage({id: 'playbooks.run_playbook_modal.name_preview_too_long', defaultMessage: 'The resolved run name exceeds the {maxLength}-character limit. Shorten the field values used in the template.'}, {maxLength: RUN_NAME_MAX_LENGTH})}
                        </ErrorMessage>
                    )}
                    {templateFields.length > 0 && (
                        <PropertyFieldsSection
                            fields={templateFields}
                            values={propertyValues}
                            onSetValues={setPropertyValues}
                            onUserKnown={handleUserKnown}
                        />
                    )}

                    <InlineLabel>{formatMessage({defaultMessage: 'Summary'})}</InlineLabel>
                    <BaseTextArea
                        data-testid={'run-summary-input'}
                        rows={5}
                        value={runSummary}
                        onChange={(e) => setRunSummary(e.target.value)}
                    />
                    <ConfigChannelSection
                        teamId={teamId}
                        channelId={channelId}
                        channelMode={channelMode}
                        createPublicRun={createPublicRun}
                        onSetCreatePublicRun={setCreatePublicRun}
                        onSetChannelMode={handleSetChannelMode}
                        onSetChannelId={setChannelId}
                    />
                    {submitError && <ErrorMessage>{submitError}</ErrorMessage>}
                </Body>
            </StyledGenericModal>
        );
    }

    // Select a playbook tab
    return (
        <StyledGenericModal
            showCancel={false}
            isConfirmDisabled={false}
            id={ID}
            modalHeaderText={(
                <RowContainer>
                    <ColContainer>
                        <HeaderTitle>
                            <FormattedMessage defaultMessage='Run playbook'/>
                        </HeaderTitle>
                        <HeaderButtonWrapper>
                            {canCreatePlaybooks &&
                                <CreatePlaybookButton
                                    onClick={onCreatePlaybook}
                                    className='btn btn-sm btn-tertiary'
                                >
                                    <FormattedMessage defaultMessage='Create new playbook'/>
                                </CreatePlaybookButton>
                            }
                        </HeaderButtonWrapper>
                    </ColContainer>
                </RowContainer>
            )}
            onHide={onHide}
            {...restModalProps}
        >
            <Body>
                <PlaybooksSelector
                    teamID={teamId}
                    channelID={triggerChannelId || ''}
                    searchTerm={searchTerm}
                    onSelectPlaybook={handleSelectPlaybook}
                />
            </Body>
        </StyledGenericModal>
    );
};

type runNameProps = {
    runName: string;
    onSetRunName: (name: string) => void;
    readOnly?: boolean;
};

const RunNameSection = ({runName, onSetRunName, readOnly}: runNameProps) => {
    const {formatMessage} = useIntl();
    const [error, setError] = useState('');

    const onRunNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (error && value.length <= RUN_NAME_MAX_LENGTH) {
            setError('');
        } else if (!error && value.length > RUN_NAME_MAX_LENGTH) {
            setError(formatMessage({id: 'playbooks.run_playbook_modal.run_name_too_long', defaultMessage: 'The run name should not exceed {maxLength} characters'}, {maxLength: RUN_NAME_MAX_LENGTH}));
        }

        onSetRunName(value);
    }, [error, formatMessage, onSetRunName]);

    let suffix = '';
    if (error) {
        suffix = ' ' + formatMessage({id: 'playbooks.run_playbook_modal.error_suffix', defaultMessage: '*'});
    } else if (readOnly) {
        suffix = ' ' + formatMessage({id: 'playbooks.run_playbook_modal.optional_suffix', defaultMessage: '(optional)'});
    }

    return (<>
        <RunNameLabel invalid={Boolean(error)}>
            {formatMessage(
                {
                    id: 'playbooks.run_playbook_modal.run_name_label',
                    defaultMessage: 'Run name{suffix}',
                },
                {suffix},
            )}
        </RunNameLabel>
        <BaseInput
            $invalid={Boolean(error)}
            $readOnly={readOnly}
            data-testid={'run-name-input'}
            autoFocus={!readOnly}
            type={'text'}
            value={runName}
            readOnly={readOnly}
            onChange={readOnly ? undefined : onRunNameChange}
        />
        {error && <ErrorMessage data-testid={'run-name-error'}>{error}</ErrorMessage>}
    </>);
};

type channelProps = {
    teamId: string;
    channelMode: string;
    channelId: string;
    createPublicRun: boolean;
    onSetCreatePublicRun: (val: boolean) => void;
    onSetChannelMode: (mode: 'link_existing_channel' | 'create_new_channel') => void;
    onSetChannelId: (channelId: string) => void;
};

const ConfigChannelSection = ({teamId, channelMode, channelId, createPublicRun, onSetCreatePublicRun, onSetChannelMode, onSetChannelId}: channelProps) => {
    const {formatMessage} = useIntl();
    const createNewChannel = channelMode === 'create_new_channel';
    const linkExistingChannel = channelMode === 'link_existing_channel';
    return (
        <ChannelContainer>
            <ChannelBlock>
                <StyledRadioInput
                    data-testid={'link-existing-channel-radio'}
                    type='radio'
                    checked={linkExistingChannel}
                    onChange={() => onSetChannelMode('link_existing_channel')}
                />
                <FormattedMessage defaultMessage='Link to an existing channel'/>
            </ChannelBlock>
            {linkExistingChannel && (
                <SelectorWrapper>
                    <StyledChannelSelector
                        id={'link-existing-channel-selector'}
                        onChannelSelected={(channel_id: string) => onSetChannelId(channel_id)}
                        channelIds={channelId ? [channelId] : []}
                        isClearable={true}
                        selectComponents={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
                        isDisabled={false}
                        captureMenuScroll={false}
                        shouldRenderValue={true}
                        teamId={teamId}
                        isMulti={false}
                    />
                </SelectorWrapper>
            )}

            <ChannelBlock >
                <StyledRadioInput
                    data-testid={'create-channel-radio'}
                    type='radio'
                    checked={createNewChannel}
                    onChange={() => onSetChannelMode('create_new_channel')}
                />
                <FormattedMessage defaultMessage='Create a run channel'/>
            </ChannelBlock>

            {createNewChannel && (
                <HorizontalSplit>
                    <VerticalSplit>
                        <ButtonLabel disabled={false}>
                            <RadioInput
                                data-testid={'create-public-channel-radio'}
                                type='radio'
                                checked={createPublicRun}
                                onChange={() => onSetCreatePublicRun(true)}
                            />
                            <Icon
                                disabled={false}
                                active={createPublicRun}
                                className={'icon-globe'}
                            />
                            <BigText>{formatMessage({defaultMessage: 'Public channel'})}</BigText>
                        </ButtonLabel>
                        <HorizontalSpacer $size={8}/>
                        <ButtonLabel disabled={false}>
                            <RadioInput
                                data-testid={'create-private-channel-radio'}
                                type='radio'
                                checked={!createPublicRun}
                                onChange={() => onSetCreatePublicRun(false)}
                            />
                            <Icon
                                disabled={false}
                                active={!createPublicRun}
                                className={'icon-lock-outline'}
                            />
                            <BigText>{formatMessage({defaultMessage: 'Private channel'})}</BigText>
                        </ButtonLabel>
                    </VerticalSplit>
                </HorizontalSplit>
            )}
        </ChannelContainer>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        h1 {
            width:100%;
        }

        .modal-header {
            padding: 24px 31px;
            margin-bottom: 0;
            box-shadow: inset 0 -1px 0 rgba(var(--center-channel-color-rgb), 0.16);
        }

        .modal-content {
            padding: 0;
        }

        .modal-body {
            padding: 24px 31px;
        }

        .modal-footer {
           padding: 0 31px 28px;
           box-shadow: inset 0 -1px 0 rgba(var(--center-channel-color-rgb), 0.16);
        }
    }
`;

const ColContainer = styled.div`
    display: flex;
    flex-direction: row;
`;

const RowContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 15px;
`;

const HeaderTitle = styled.div`
    display: flex;
    height: 28px;
    flex-direction: row;
    align-items: center;
`;

const IconWrapper = styled.button`
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    height: 28px;
    flex-direction: column;
    justify-content: center;
    margin-right: 8px;

    &:focus-visible {
        outline: 2px solid var(--button-bg);
        border-radius: 4px;
    }
`;

const Body = styled.div`
    display: flex;
    flex-direction: column;

    & > div, & > input {
        margin-bottom: 12px;
    }
`;

const ChannelContainer = styled.div`
    display: flex;
    flex-direction: column;
    margin-top: 39px;
    gap: 16px;
`;

const StyledRadioInput = styled(RadioInput)`
    && {
        margin: 0;
    }
`;

const ChannelBlock = styled.label`
    display: flex;
    width: 350px;
    flex-direction: row;
    align-items: center;
    align-self: flex-start;
    margin-bottom: 0;
    column-gap: 12px;
    cursor: pointer;
    font-weight: inherit;
`;

const SelectorWrapper = styled.div`
    min-height: 40px;
    margin-left: 28px;
`;

const Icon = styled.i<{ active?: boolean, disabled: boolean }>`
    color: ${({active, disabled}) => (active && !disabled ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
    font-size: 16px;
    line-height: 16px;
`;

const BigText = styled.div`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
`;

const HorizontalSplit = styled.div`
    display: block;
    margin-left: 28px;
    text-align: left;
`;

const HeaderButtonWrapper = styled.div`
    margin-right: 30px;
    margin-left: auto;
`;
const CreatePlaybookButton = styled.button`
    /* no additional styles */
`;

const RunNameLabel = styled(InlineLabel)<{invalid?: boolean}>`
    color: ${(props) => (props.invalid ? 'var(--error-text)' : 'rgba(var(--center-channel-color-rgb), 0.64)')};
`;

const ErrorMessage = styled.div`
    margin-top: -8px;
    margin-bottom: 20px;
    color: var(--error-text);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
`;

const NamePreview = styled.div`
    margin-top: -8px;
    margin-bottom: 8px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    line-height: 16px;
`;

type PropertyFieldsSectionProps = {
    fields: TemplatePropertyField[];
    values: Record<string, unknown>;
    onSetValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
    onUserKnown?: (user: {id: string} & Record<string, unknown>) => void;
};

const PropertyFieldsSection = ({fields, values, onSetValues, onUserKnown}: PropertyFieldsSectionProps) => {
    const {formatMessage} = useIntl();
    const profilesInTeam = useProfilesInTeam();
    const profilesRef = useRef(profilesInTeam);
    profilesRef.current = profilesInTeam;
    const fetchAllUsersInTeam = useCallback(async () => profilesRef.current, []);

    const updateValue = useCallback((fieldId: string, value: unknown) => {
        onSetValues((prev) => ({...prev, [fieldId]: value}));
    }, [onSetValues]);

    return (
        <PropertyFieldsContainer>
            <InlineLabel>{formatMessage({id: 'playbooks.run_playbook_modal.attributes_label', defaultMessage: 'Attributes'})}</InlineLabel>
            {fields.map((field) => {
                return (
                    <PropertyFieldRow key={field.id}>
                        <PropertyFieldLabel htmlFor={`property-field-${field.id}`}>
                            {field.name}
                        </PropertyFieldLabel>
                        <PropertyFieldInput
                            field={field}
                            value={values[field.id]}
                            onChange={updateValue}
                            fetchAllUsersInTeam={fetchAllUsersInTeam}
                            inputId={`property-field-${field.id}`}
                            onUserKnown={onUserKnown}
                        />
                    </PropertyFieldRow>
                );
            })}
        </PropertyFieldsContainer>
    );
};

// Format a millisecond timestamp or date string to an HTML date input value (YYYY-MM-DD)
function formatDateInputValue(value: string | number): string {
    if (typeof value === 'number' && value > 0) {
        return new Date(value).toISOString().split('T')[0];
    }
    if (typeof value === 'string' && value) {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed > 0) {
            return new Date(parsed).toISOString().split('T')[0];
        }
        return value;
    }
    return '';
}

type PropertyFieldInputProps = {
    field: TemplatePropertyField;
    value?: unknown;
    onChange: (fieldId: string, value: unknown) => void;
    fetchAllUsersInTeam: () => Promise<ReturnType<typeof useProfilesInTeam>>;
    inputId?: string;
    onUserKnown?: (user: {id: string} & Record<string, unknown>) => void;
};

type UserFieldInputProps = {
    field: TemplatePropertyField;
    value?: unknown;
    onChange: (fieldId: string, value: unknown) => void;
    fetchAllUsersInTeam: () => Promise<ReturnType<typeof useProfilesInTeam>>;
    onUserKnown?: (user: {id: string} & Record<string, unknown>) => void;
};

const UserFieldInput = ({field, value, onChange, fetchAllUsersInTeam, onUserKnown}: UserFieldInputProps) => {
    const {formatMessage} = useIntl();
    const selectedUserId = typeof value === 'string' && value ? value : undefined;

    return (
        <ModalProfileSelector
            data-testid={`property-field-${field.id}`}
            selectedUserId={selectedUserId}
            placeholder={formatMessage({defaultMessage: 'Select user...'})}
            enableEdit={true}
            isClearable={true}
            selfIsFirstOption={true}
            getAllUsers={fetchAllUsersInTeam}
            onSelectedChange={(user) => {
                if (user) {
                    onUserKnown?.(user as {id: string} & Record<string, unknown>);
                }
                onChange(field.id, user?.id ?? '');
            }}
        />
    );
};

const PropertyFieldInput = ({field, value, onChange, fetchAllUsersInTeam, inputId, onUserKnown}: PropertyFieldInputProps) => {
    const {formatMessage} = useIntl();

    if (field.type === 'user') {
        return (
            <UserFieldInput
                field={field}
                value={value}
                onChange={onChange}
                fetchAllUsersInTeam={fetchAllUsersInTeam}
                onUserKnown={onUserKnown}
            />
        );
    }

    if (field.type === 'multiuser') {
        const selectedIds = Array.isArray(value) ? value as string[] : [];
        return (
            <MultiuserFieldContainer>
                {selectedIds.length > 0 && (
                    <MultiuserChipsContainer>
                        {selectedIds.map((uid) => (
                            <MultiuserChip key={uid}>
                                <Profile
                                    userId={uid}
                                    withoutName={true}
                                />
                                <MultiuserRemoveButton
                                    onClick={() => onChange(field.id, selectedIds.filter((id) => id !== uid))}
                                    type='button'
                                    aria-label={formatMessage({defaultMessage: 'Remove user'})}
                                >
                                    <CloseIcon size={12}/>
                                </MultiuserRemoveButton>
                            </MultiuserChip>
                        ))}
                    </MultiuserChipsContainer>
                )}
                <ModalProfileSelector
                    data-testid={`property-field-${field.id}`}
                    placeholder={formatMessage({defaultMessage: 'Add user...'})}
                    enableEdit={true}
                    isClearable={false}
                    selfIsFirstOption={true}
                    getAllUsers={fetchAllUsersInTeam}
                    onSelectedChange={(user) => {
                        if (!user) {
                            return;
                        }
                        onUserKnown?.(user as {id: string} & Record<string, unknown>);
                        if (selectedIds.includes(user.id)) {
                            onChange(field.id, selectedIds.filter((id) => id !== user.id));
                        } else {
                            onChange(field.id, [...selectedIds, user.id]);
                        }
                    }}
                />
            </MultiuserFieldContainer>
        );
    }

    if (field.type === 'date') {
        return (
            <BaseInput
                id={inputId}
                data-testid={`property-field-${field.id}`}
                type='date'
                value={typeof value === 'string' || typeof value === 'number' ? formatDateInputValue(value) : ''
                }
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const dateStr = e.target.value;
                    if (dateStr) {
                        const millis = new Date(dateStr + 'T00:00:00Z').getTime();
                        onChange(field.id, millis);
                    } else {
                        onChange(field.id, '');
                    }
                }}
            />
        );
    }

    if (field.type === 'select' || field.type === 'multiselect') {
        const options = (field.attrs.options ?? []).map((opt) => ({
            value: opt.id,
            label: opt.name,
        }));

        const isMulti = field.type === 'multiselect';

        const selectedValue = isMulti ? options.filter((opt) => Array.isArray(value) && (value as string[]).includes(opt.value)) : options.find((opt) => opt.value === value) ?? null;

        return (
            <StyledSelect
                inputId={inputId}
                data-testid={`property-field-${field.id}`}
                options={options}
                value={selectedValue}
                onChange={(opt: {value: string} | {value: string}[] | null) => {
                    if (isMulti && Array.isArray(opt)) {
                        onChange(field.id, opt.map((o) => o.value));
                    } else if (opt && !Array.isArray(opt)) {
                        onChange(field.id, opt.value);
                    } else {
                        onChange(field.id, isMulti ? [] : '');
                    }
                }}
                isClearable={true}
                isMulti={isMulti}
                placeholder={isMulti ? formatMessage({id: 'playbooks.run_playbook_modal.select_options', defaultMessage: 'Select options...'}) : formatMessage({id: 'playbooks.run_playbook_modal.select', defaultMessage: 'Select...'})
                }
            />
        );
    }

    return (
        <BaseInput
            id={inputId}
            data-testid={`property-field-${field.id}`}
            type='text'
            value={typeof value === 'string' ? value : ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(field.id, e.target.value)}
        />
    );
};

const ModalProfileSelector = styled(ProfileSelector)`
    width: 100%;
`;

const PropertyFieldsContainer = styled.div`
    position: relative;
    z-index: 2;
    margin-bottom: 12px;
`;

const PropertyFieldRow = styled.div`
    display: flex;
    flex-direction: column;
    margin-bottom: 8px;
`;

const PropertyFieldLabel = styled.label`
    margin-bottom: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
`;

const MultiuserFieldContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const MultiuserChipsContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
`;

const MultiuserChip = styled.div`
    display: flex;
    align-items: center;
    gap: 2px;
    background-color: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 12px;
    padding: 2px 6px;
`;

const LoadingContainer = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px 0;
`;

const MultiuserRemoveButton = styled.button`
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
    padding: 0 2px;
    line-height: 1;

    &:hover {
        color: var(--error-text);
    }
`;

const ApolloWrappedModal = (props: Props) => {
    const client = getPlaybooksGraphQLClient();
    return <ApolloProvider client={client}><RunPlaybookModal {...props}/></ApolloProvider>;
};

