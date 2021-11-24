// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage, useIntl} from 'react-intl';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {Overlay, Popover, PopoverProps} from 'react-bootstrap';
import Scrollbars from 'react-custom-scrollbars';
import {useDispatch, useSelector} from 'react-redux';
import {components, ControlProps} from 'react-select';
import styled, {css} from 'styled-components';
import {DraggableProvided} from 'react-beautiful-dnd';

import {handleFormattedTextClick} from 'src/browser_routing';
import {
    clientSkipChecklistItem,
    clientRestoreChecklistItem,
    clientRunChecklistItemSlashCommand,
    setAssignee,
    clientEditChecklistItem,
} from 'src/client';
import Spinner from 'src/components/assets/icons/spinner';
import {ChecklistItemButton} from 'src/components/checklist_item_input';
import Profile from 'src/components/profile/profile';
import ProfileSelector, {Option as ProfileOption} from 'src/components/profile/profile_selector';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {formatText, messageHtmlToComponent} from 'src/webapp_globals';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {useClickOutsideRef, useProfilesInCurrentChannel, useTimeout} from 'src/hooks';
import {ChannelNamesMap} from 'src/types/backstage';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';

import MarkdownTextbox from 'src/components/markdown_textbox';

import CommandInput from './command_input';
import GenericModal from './widgets/generic_modal';
import {BaseInput} from './assets/inputs';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    checklistNum: number;
    itemNum: number;
    channelId: string;
    playbookRunId: string;
    onChange?: (item: ChecklistItemState) => void;
    onRedirect?: () => void;
    draggableProvided?: DraggableProvided;
    dragging: boolean;
    disabled: boolean;
    collapsibleDescription: boolean;
}

const RunningTimeout = 1000;

const StyledPopover = styled(Popover) <PopoverProps>`
    min-width: 180px;
    border-radius: 8px;

    .popover-content {
        padding: 16px 0px 15px 20px;
    }

    && .arrow {
        display: block;
    }
`;

const PaddedDiv = styled.div`
    padding-right: 15px;
`;

const StyledSpinner = styled(Spinner)`
    margin-left: 4px;
    padding-top: 3px;
`;

const ItemContainer = styled.div`
    padding-top: 1.3rem;

    :first-child {
        padding-top: 0.4rem;
    }
`;

const ExtrasRow = styled.div`
    display: flex;
    margin: 4px 0 0 32px;
    line-height: 16px;

    > div {
        margin: 0 5px;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
        border-radius: 13px;
        padding: 2px 8px;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        display: flex;
        max-width: 100%;
    }
`;

const SmallProfile = styled(Profile)`
    > .image {
        width: 16px;
        height: 16px;
    }
`;

export const CheckboxContainer = styled.div`
    align-items: flex-start;
    display: flex;
    position: relative;

    button {
        width: 53px;
        height: 29px;
        border: 1px solid #166DE0;
        box-sizing: border-box;
        border-radius: 4px;
        font-family: Open Sans;
        font-style: normal;
        font-weight: 600;
        font-size: 12px;
        line-height: 17px;
        text-align: center;
        background: #ffffff;
        color: #166DE0;
        cursor: pointer;
        margin-right: 13px;
    }

    button:disabled {
        border: 0px;
        color: var(--button-color);
        background: var(--center-channel-color-56);
        cursor: default;
    }

    &:hover {
        .checkbox-container__close {
            opacity: 1;
        }
    }

    .icon-bars {
        padding: 0 0.8rem 0 0;
    }

    input[type="checkbox"] {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        width: 20px;
        min-width: 20px;
        height: 20px;
        background: #ffffff;
        border: 2px solid var(--center-channel-color-24);
        border-radius: 4px;
        margin: 0;
        cursor: pointer;
        margin-right: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    input[type="checkbox"]:checked {
        background: var(--button-bg);
        border: 1px solid var(--button-bg);
        box-sizing: border-box;
    }

    input[type="checkbox"]::before {
        font-family: 'compass-icons', mattermosticons;
        text-rendering: auto;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        content: "\f12c";
        font-size: 12px;
        font-weight: bold;
        color: #ffffff;
        transition: transform 0.15s;
        transform: scale(0) rotate(90deg);
        position: relative;
    }

    input[type="checkbox"]:checked::before {
        transform: scale(1) rotate(0deg);
    }

    input[type="checkbox"]:disabled {
        opacity: 0.38;
    }

    label {
        font-weight: normal;
        word-break: break-word;
        display: inline;
        margin: 0;
        margin-right: 8px;
        flex-grow: 1;
    }
`;

const ChecklistItemLabel = styled.div<{clickable: boolean}>`
    display: flex;
    flex-direction: column;
    width: 100%;

    ${({clickable}) => clickable && css`
        cursor: pointer;

        // This is somehow needed to override the
        // cursor style in the item title
        label {
            cursor: pointer;
        }
    `}
`;

const ChecklistItemDescription = styled.div<{height: string}>`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    max-width: 630px;
    margin: 4px 0 0 2px;

    // Fix default markdown styling in the paragraphs
    p {
        :last-child {
            margin-bottom: 0;
        }

        white-space: pre-wrap;
    }
    height: ${({height}) => height};

    transition: height 0.2s ease-in-out;
    overflow: hidden;
`;

const Command = styled.div`
    word-break: break-word;
    display: inline;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 11px;
`;

interface RunProps {
    running: boolean;
}

const Run = styled.div<RunProps>`
    font-size: 12px;
    font-weight: bold;
    display: inline;
    color: var(--link-color);
    cursor: pointer;
    margin: 2px 4px 0 0;

    &:hover {
        text-decoration: underline;
    }

    ${({running}) => running && `
        color: var(--center-channel-color-64);
        cursor: default;

        &:hover {
            text-decoration: none;
        }
    `}
`;

interface StepDescriptionProps {
    text: string;
    channelNames: ChannelNamesMap;
    team: Team;
}

const StepDescription = (props: StepDescriptionProps): React.ReactElement<StepDescriptionProps> => {
    const [showTooltip, setShowTooltip] = useState(false);
    const {formatMessage} = useIntl();
    const target = useRef(null);
    const popoverRef = useRef(null);
    useClickOutsideRef(popoverRef, () => {
        setShowTooltip(false);
    });
    const markdownOptions = {
        atMentions: true,
        team: props.team,
        channelNamesMap: props.channelNames,
    };

    return (
        <>
            <HoverMenuButton
                title={formatMessage({defaultMessage: 'Description'})}
                tabIndex={0}
                className={'icon-information-outline icon-16 btn-icon'}
                ref={target}
                onClick={() => setShowTooltip(!showTooltip)}
            />
            <Overlay
                show={showTooltip}
                placement={'top'}
                target={target.current}
            >
                <StyledPopover id='info-icon'>
                    <div
                        ref={popoverRef}
                    >
                        <Scrollbars
                            autoHeight={true}
                            autoHeightMax={200}
                            renderThumbVertical={(thumbProps) => (
                                <div
                                    {...thumbProps}
                                    className='scrollbar--vertical'
                                />
                            )}
                        >
                            <PaddedDiv>
                                {messageHtmlToComponent(formatText(props.text, markdownOptions), true, {})}
                            </PaddedDiv>
                        </Scrollbars>
                    </div>
                </StyledPopover>
            </Overlay>
        </>
    );
};

const ControlComponentAnchor = styled.a`
    display: inline-block;
    margin: 0 0 8px 12px;
    font-weight: 600;
    font-size: 12px;
    position: relative;
    top: -4px;
`;

const ControlComponent = (ownProps: ControlProps<ProfileOption, boolean>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                <FormattedMessage defaultMessage='No Assignee'/>
            </ControlComponentAnchor>
        )}
    </div>
);

const portal: HTMLElement = document.createElement('div');
document.body.appendChild(portal);

export const ChecklistItemDetails = (props: ChecklistItemDetailsProps): React.ReactElement => {
    const commandRef = useRef(null);
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const relativeTeamUrl = useSelector<GlobalState, string>(getCurrentRelativeTeamUrl);
    const profilesInChannel = useProfilesInCurrentChannel();
    const [showDescription, setShowDescription] = useState(true);

    const markdownOptions = {
        singleline: true,
        mentionHighlight: false,
        atMentions: true,
        team,
        channelNamesMap,
    };

    const [running, setRunning] = useState(false);
    const [lastRun, setLastRun] = useState(props.checklistItem.command_last_run);
    const [showMenu, setShowMenu] = useState(false);
    const [showSkipConfirm, setShowSkipConfirm] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);

    // Immediately stop the running indicator when we get notified of a more recent execution.
    if (props.checklistItem.command_last_run > lastRun) {
        setRunning(false);
        setLastRun(props.checklistItem.command_last_run);
    }

    // Setting running to true triggers the timeout by setting the delay to RunningTimeout
    useTimeout(() => setRunning(false), running ? RunningTimeout : null);

    const fetchUsers = async () => {
        return profilesInChannel;
    };

    const onAssigneeChange = async (userId?: string) => {
        if (!props.playbookRunId) {
            return;
        }
        const response = await setAssignee(props.playbookRunId, props.checklistNum, props.itemNum, userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
    };

    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);
    const assignee_id = props.checklistItem.assignee_id; // to make typescript happy

    const title = props.checklistItem.title;
    const labelText = messageHtmlToComponent(formatText(props.checklistItem.title, markdownOptions), true, {});

    const resetAssignee = () => {
        onAssigneeChange();
        setProfileSelectorToggle(!profileSelectorToggle);
    };

    const toggleDescription = () => setShowDescription(!showDescription);

    const content = (
        <>
            <ItemContainer
                ref={props.draggableProvided?.innerRef}
                {...props.draggableProvided?.draggableProps}
                onMouseEnter={() => setShowMenu(true)}
                onMouseLeave={() => setShowMenu(false)}
                data-testid='checkbox-item-container'
            >
                <CheckboxContainer>
                    {showMenu && (!props.disabled || props.checklistItem.description !== '') &&
                    <HoverMenu>
                        {props.collapsibleDescription && props.checklistItem.description !== '' &&
                            <ToggleDescriptionButton
                                title={formatMessage({defaultMessage: 'Toggle description'})}
                                className={'icon icon-chevron-up'}
                                showDescription={showDescription}
                                onClick={toggleDescription}
                            />
                        }
                        {!props.disabled &&
                            <HoverMenuButton
                                title={formatMessage({defaultMessage: 'Drag me to reorder'})}
                                className={'icon icon-menu'}
                                {...props.draggableProvided?.dragHandleProps}
                            />
                        }
                        {!props.disabled &&
                            <>
                                <ProfileSelector
                                    selectedUserId={props.checklistItem.assignee_id}
                                    onlyPlaceholder={true}
                                    placeholder={
                                        <HoverMenuButton
                                            title={formatMessage({defaultMessage: 'Assign'})}
                                            className={'icon-account-plus-outline icon-16 btn-icon'}
                                        />
                                    }
                                    enableEdit={true}
                                    getUsers={fetchUsers}
                                    onSelectedChange={onAssigneeChange}
                                    selfIsFirstOption={true}
                                    customControl={ControlComponent}
                                    customControlProps={{
                                        showCustomReset: Boolean(assignee_id),
                                        onCustomReset: resetAssignee,
                                    }}
                                    controlledOpenToggle={profileSelectorToggle}
                                    showOnRight={true}
                                />
                                <HoverMenuButton
                                    title={formatMessage({defaultMessage: 'Edit'})}
                                    className={'icon-pencil-outline icon-16 btn-icon'}
                                    onClick={() => {
                                        setShowEditDialog(true);
                                    }}
                                />
                                <HoverMenuButton
                                    title={(props.checklistItem.state === ChecklistItemState.Skip) ? formatMessage({defaultMessage: 'Restore'}) : formatMessage({defaultMessage: 'Skip'})}
                                    className={(props.checklistItem.state === ChecklistItemState.Skip) ? 'icon-refresh icon-16 btn-icon' : 'icon-close-circle-outline icon-16 btn-icon'}
                                    onClick={() => {
                                        if (props.checklistItem.state === ChecklistItemState.Skip) {
                                            setShowRestoreConfirm(true);
                                        } else {
                                            setShowSkipConfirm(true);
                                        }
                                    }}
                                />
                            </>
                        }
                    </HoverMenu>
                    }
                    <ChecklistItemButton
                        disabled={props.disabled || props.checklistItem.state === ChecklistItemState.Skip}
                        item={props.checklistItem}
                        onChange={(item: ChecklistItemState) => {
                            if (props.onChange) {
                                props.onChange(item);
                            }
                        }}
                    />
                    <ChecklistItemLabel
                        onClick={() => props.collapsibleDescription && props.checklistItem.description !== '' && toggleDescription()}
                        clickable={props.collapsibleDescription && props.checklistItem.description !== ''}
                    >
                        <label title={title}>
                            <div
                                onClick={((e) => handleFormattedTextClick(e, relativeTeamUrl))}
                            >
                                {(props.checklistItem.state === ChecklistItemState.Skip) ? <StrikeThrough className={'skipped'}>{labelText}</StrikeThrough> : labelText}
                            </div>
                        </label>
                        <CollapsibleChecklistItemDescription expanded={showDescription}>
                            {messageHtmlToComponent(formatText(props.checklistItem.description, {...markdownOptions, singleline: false}), true, {})}
                        </CollapsibleChecklistItemDescription>
                    </ChecklistItemLabel>
                </CheckboxContainer>
                <ExtrasRow>
                    {props.checklistItem.assignee_id &&
                    <SmallProfile
                        userId={props.checklistItem.assignee_id}
                    />
                    }
                    {
                        props.checklistItem.command !== '' &&
                        <div ref={commandRef}>
                            {!props.disabled &&
                                <Run
                                    data-testid={'run'}
                                    running={running}
                                    onClick={() => {
                                        if (!running) {
                                            setRunning(true);
                                            clientRunChecklistItemSlashCommand(dispatch, props.playbookRunId, props.checklistNum, props.itemNum);
                                        }
                                    }}
                                >
                                    {props.checklistItem.command_last_run ? 'Rerun' : 'Run'}
                                </Run>
                            }
                            <Command>
                                <TextWithTooltipWhenEllipsis
                                    id={props.checklistNum.toString(10)}
                                    text={props.checklistItem.command}
                                    parentRef={commandRef}
                                />
                            </Command>
                            {running && <StyledSpinner/>}
                        </div>
                    }
                </ExtrasRow>
            </ItemContainer>
            <ConfirmModal
                show={showSkipConfirm}
                title={formatMessage({defaultMessage: 'Skip task'})}
                message={formatMessage({defaultMessage: 'Are you sure you want to skip this task? This will be crossed from this run but will not affect the playbook.'})}
                confirmButtonText={formatMessage({defaultMessage: 'Skip'})}
                onConfirm={() => {
                    clientSkipChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum);
                    if (props.onChange) {
                        props.onChange(ChecklistItemState.Skip);
                    }
                    setShowSkipConfirm(false);
                }
                }
                onCancel={() => setShowSkipConfirm(false)}
            />
            <ConfirmModal
                show={showRestoreConfirm}
                title={formatMessage({defaultMessage: 'Restore task'})}
                message={formatMessage({defaultMessage: 'Are you sure you want to Restore this task? This Task will be added to this run'})}
                confirmButtonText={formatMessage({defaultMessage: 'Restore'})}
                onConfirm={() => {
                    clientRestoreChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum);
                    if (props.onChange) {
                        props.onChange(ChecklistItemState.Open);
                    }
                    setShowRestoreConfirm(false);
                }
                }
                onCancel={() => setShowRestoreConfirm(false)}
            />
            <ChecklistItemEditModal
                show={showEditDialog}
                playbookRunId={props.playbookRunId}
                channelId={props.channelId}
                checklistNum={props.checklistNum}
                itemNum={props.itemNum}
                onDone={() => setShowEditDialog(false)}
                taskTitle={props.checklistItem.title}
                taskDescription={props.checklistItem.description}
                taskCommand={props.checklistItem.command}
            />
        </>
    );

    if (props.dragging) {
        return ReactDOM.createPortal(content, portal);
    }

    return content;
};

const ToggleDescriptionButton = styled(HoverMenuButton)<{showDescription: boolean}>`
    transition: all 0.2s linear;
    transform: ${({showDescription}) => (showDescription ? 'rotate(0deg)' : 'rotate(180deg)')};
`;

const CollapsibleChecklistItemDescription = (props: {expanded: boolean, children: React.ReactNode}) => {
    const ref = useRef<HTMLDivElement|null>(null);

    let computedHeight = 'auto';
    if (ref?.current) {
        computedHeight = ref.current.scrollHeight + 'px';
    }

    return (
        <ChecklistItemDescription
            ref={ref}
            height={props.expanded ? computedHeight : '0'}
        >
            {props.children}
        </ChecklistItemDescription>
    );
};

interface ChecklistItemEditModalProps {
    show: boolean;
    onDone: () => void;
    checklistNum: number;
    playbookRunId: string;
    channelId: string;
    itemNum: number;
    taskTitle: string;
    taskDescription: string;
    taskCommand: string;
}

const ModalField = styled(BaseInput)`
    width: 100%;
`;

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    color: var(--center-channel-color);

    > * {
        margin-bottom: 10px;
    }
`;

const StrikeThrough = styled.text`
    text-decoration: line-through;
`;

const ChecklistItemEditModal = (props: ChecklistItemEditModalProps) => {
    const {formatMessage} = useIntl();
    const [title, setTitle] = useState(props.taskTitle);
    const [description, setDescription] = useState<string>(props.taskDescription);
    const [command, setCommand] = useState(props.taskCommand);

    const submit = () => {
        clientEditChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum, {
            title,
            command,
            description,
        });
        props.onDone();
    };

    return (
        <GenericModal
            id={'taskEditModalc' + props.checklistNum + 'i' + props.itemNum}
            show={props.show}
            modalHeaderText={formatMessage({defaultMessage: 'Edit task'})}
            onHide={props.onDone}
            confirmButtonText={formatMessage({defaultMessage: 'Edit task'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            handleCancel={props.onDone}
            handleConfirm={submit}
        >
            <FormContainer>
                <ModalField
                    placeholder={formatMessage({defaultMessage: 'Task name'})}
                    type='text'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus={true}
                />
                <CommandInput
                    command={command}
                    setCommand={setCommand}
                    autocompleteOnBottom={true}
                />
                <MarkdownTextbox
                    className={'description_textarea'}
                    id={`taskEditTextbox_c${props.checklistNum}i${props.itemNum}`}
                    value={description ?? ''}
                    setValue={setDescription}
                    channelId={props.channelId}
                    createMessage={formatMessage({defaultMessage: 'Task description'})}
                />
            </FormContainer>
        </GenericModal>
    );
};
