// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useRef, useState} from 'react';
import {useDispatch, useStore, useSelector} from 'react-redux';
import moment from 'moment';
import classNames from 'classnames';
import {components, ControlProps} from 'react-select';
import styled from 'styled-components';
import {Overlay, Popover, PopoverProps} from 'react-bootstrap';
import Scrollbars from 'react-custom-scrollbars';

import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {clientExecuteCommand, fetchUsersInChannel, setAssignee} from 'src/client';
import Spinner from 'src/components/assets/icons/spinner';
import ProfileSelector from 'src/components/profile/profile_selector';
import {useTimeout} from 'src/hooks';
import {handleFormattedTextClick} from 'src/browser_routing';
import {ChannelNamesMap} from 'src/types/backstage';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    checklistNum: number;
    itemNum: number;
    channelId: string;
    incidentId?: string;
    onChange?: (item: ChecklistItemState) => void;
    onRedirect?: () => void;
}

const RunningTimeout = 1000;

// @ts-ignore
const {formatText, messageHtmlToComponent} = window.PostUtils;

const HoverableIcon = styled.i`
    color: var(--center-channel-color-56);
    cursor: pointer;

    &:hover {
        color: var(--center-channel-color);
    }
`;

const InfoIcon = styled(HoverableIcon)`
    position: relative;
    top: 2px;
`;

const CloseIcon = styled(HoverableIcon)`
    position: absolute;
    right: 13px;
    top: 13px;
`;

const StyledPopover = styled(Popover)<PopoverProps>`
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

const DescriptionTitle = styled.span`
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
`;

interface StepDescriptionProps {
    text: string;
    channelNames: ChannelNamesMap;
    team: Team;
}

const StepDescription = (props: StepDescriptionProps) : React.ReactElement<StepDescriptionProps> => {
    const [showTooltip, setShowTooltip] = useState(false);
    const target = useRef(null);

    const markdownOptions = {
        atMentions: true,
        team: props.team,
        channelNamesMap: props.channelNames,
    };

    return (
        <>
            <InfoIcon
                tabIndex={0}
                className={'icon icon-information-outline'}
                ref={target}
                onClick={() => setShowTooltip(!showTooltip)}
            />
            <Overlay
                show={showTooltip}
                placement={'top'}
                target={target.current}
            >
                <StyledPopover id='info-icon'>
                    <CloseIcon
                        className={'icon icon-close'}
                        onClick={() => setShowTooltip(false)}
                    />
                    <DescriptionTitle>{'Step Description'}</DescriptionTitle>
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
                </StyledPopover>
            </Overlay>
        </>
    );
};

export const ChecklistItemDetails = (props: ChecklistItemDetailsProps): React.ReactElement => {
    const store = useStore();
    const dispatch = useDispatch();
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const relativeTeamUrl = useSelector<GlobalState, string>(getCurrentRelativeTeamUrl);

    const markdownOptions = {
        singleline: true,
        mentionHighlight: false,
        atMentions: true,
        team,
        channelNamesMap,
    };

    const [running, setRunning] = useState(false);

    // Setting running to true triggers the timeout by setting the delay to RunningTimeout
    useTimeout(() => setRunning(false), running ? RunningTimeout : null);

    const fetchUsers = async () => {
        return fetchUsersInChannel(props.channelId);
    };

    const onAssigneeChange = async (userId?: string) => {
        if (!props.incidentId) {
            return;
        }
        const response = await setAssignee(props.incidentId, props.checklistNum, props.itemNum, userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
    };

    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);
    const assignee_id = props.checklistItem.assignee_id; // to make typescript happy
    const ControlComponent = (ownProps: ControlProps<any>) => {
        const resetLink = assignee_id && (
            <a
                className='IncidentFilter-reset'
                onClick={() => {
                    onAssigneeChange();
                    setProfileSelectorToggle(!profileSelectorToggle);
                }}
            >
                {'No Assignee'}
            </a>
        );

        return (
            <div>
                <components.Control {...ownProps}/>
                {resetLink}
            </div>
        );
    };

    let timestamp = '';
    const title = props.checklistItem.title;

    if (props.checklistItem.state === ChecklistItemState.Closed && props.checklistItem.state_modified) {
        const stateModified = moment.unix(props.checklistItem.state_modified);

        // Avoid times before 2020 since those are errors
        if (stateModified.isSameOrAfter('2020-01-01')) {
            timestamp = '(' + stateModified.calendar(undefined, {sameDay: 'LT'}) + ')'; //eslint-disable-line no-undefined
        }
    }

    return (
        <>
            <div
                className={'checkbox-container live'}
            >
                <ChecklistItemButton
                    item={props.checklistItem}
                    onChange={(item: ChecklistItemState) => {
                        if (props.onChange) {
                            props.onChange(item);
                        }
                    }}
                />
                <label title={title}>
                    <div
                        onClick={((e) => handleFormattedTextClick(e, relativeTeamUrl))}
                    >
                        {messageHtmlToComponent(formatText(title, markdownOptions), true, {})}
                        {props.checklistItem.description !== '' &&
                            <StepDescription
                                text={props.checklistItem.description}
                                channelNames={channelNamesMap}
                                team={team}
                            />
                        }
                    </div>
                </label>
                <a
                    className={'timestamp small'}
                    href={`/_redirect/pl/${props.checklistItem.state_modified_post_id}`}
                    onClick={(e) => {
                        e.preventDefault();
                        if (!props.checklistItem.state_modified_post_id) {
                            return;
                        }

                        // @ts-ignore
                        window.WebappUtils.browserHistory.push(`/_redirect/pl/${props.checklistItem.state_modified_post_id}`);
                        if (props.onRedirect) {
                            props.onRedirect();
                        }
                    }}
                >
                    {timestamp}
                </a>
            </div>
            {
                props.checklistItem.command !== '' &&
                <div className={'checklist-command-container'}>
                    <div className={'command'}>
                        {props.checklistItem.command}
                    </div>
                    <div
                        className={classNames('run', {running})}
                        onClick={() => {
                            if (!running) {
                                setRunning(true);
                                clientExecuteCommand(dispatch, store.getState, props.checklistItem.command);
                            }
                        }}
                    >
                        {'(Run)'}
                    </div>
                    {running && <Spinner/>}
                </div>
            }
            <div className={'assignee-container'}>
                <ProfileSelector
                    selectedUserId={props.checklistItem.assignee_id}
                    placeholder={'No Assignee'}
                    placeholderButtonClass={'NoAssignee-button'}
                    profileButtonClass={'Assigned-button'}
                    enableEdit={true}
                    getUsers={fetchUsers}
                    onSelectedChange={onAssigneeChange}
                    withoutProfilePic={true}
                    selfIsFirstOption={true}
                    customControl={ControlComponent}
                    controlledOpenToggle={profileSelectorToggle}
                />
            </div>
        </>
    );
};

interface ChecklistItemDetailsEditProps {
    commandInputId: string;
    channelId?: string;
    checklistItem: ChecklistItem;
    suggestionsOnBottom?: boolean;
    onEdit: (newvalue: ChecklistItem) => void;
    onRemove: () => void;
}

export const ChecklistItemDetailsEdit = ({commandInputId, channelId, checklistItem, suggestionsOnBottom, onEdit, onRemove}: ChecklistItemDetailsEditProps): React.ReactElement => {
    const commandInputRef = useRef(null);
    const [title, setTitle] = useState(checklistItem.title);
    const [description, setDescription] = useState(checklistItem.description);
    const [command, setCommand] = useState(checklistItem.command);

    const submit = () => {
        const trimmedTitle = title.trim();
        const trimmedCommand = command.trim();
        if (trimmedTitle === '') {
            setTitle(checklistItem.title);
            return;
        }
        if (trimmedTitle !== checklistItem.title || trimmedCommand !== checklistItem.command || description !== checklistItem.description) {
            onEdit({...checklistItem, ...{title: trimmedTitle, command: trimmedCommand, description}});
        }
    };

    // @ts-ignore
    const AutocompleteTextbox = window.Components.Textbox;

    const suggestionListStyle = suggestionsOnBottom ? 'bottom' : 'top';

    return (
        <div
            className='checkbox-container'
        >
            <i
                className='icon icon-menu pr-2'
            />
            <div className='checkbox-textboxes'>
                <input
                    className='form-control'
                    type='text'
                    value={title}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={submit}
                    placeholder={'Title'}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                            submit();
                        }
                    }}
                    onChange={(e) => {
                        setTitle(e.target.value);
                    }}
                />
                <AutocompleteTextbox
                    ref={commandInputRef}
                    id={commandInputId}
                    channelId={channelId}
                    inputComponent={'input'}
                    createMessage={'/slash command'}
                    onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                            if (commandInputRef.current) {
                                // @ts-ignore
                                commandInputRef.current!.blur();
                            }
                        }
                    }}
                    onChange={(e: React.FormEvent<HTMLInputElement>) => {
                        if (e.target) {
                            const input = e.target as HTMLInputElement;
                            setCommand(input.value);
                        }
                    }}
                    suggestionListStyle={suggestionListStyle}

                    className='form-control'
                    type='text'
                    value={command}
                    onBlur={submit}

                    // the following are required props but aren't used
                    characterLimit={256}
                    onKeyPress={(e: KeyboardEvent) => true}
                />
                <textarea
                    className='form-control'
                    value={description}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={submit}
                    placeholder={'Step description'}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            submit();
                        }
                    }}
                    onChange={(e) => {
                        setDescription(e.target.value);
                    }}
                />
            </div>
            <span
                onClick={onRemove}
                className='checkbox-container__close'
            >
                <i className='icon icon-close'/>
            </span>
        </div>
    );
};

interface ChecklistItemButtonProps {
    onChange: (item: ChecklistItemState) => void;
    item: ChecklistItem;
}

const ChecklistItemButton: FC<ChecklistItemButtonProps> = (props: ChecklistItemButtonProps) => {
    const isChecked = props.item.state === ChecklistItemState.Closed;
    const nextState = isChecked ? ChecklistItemState.Open : ChecklistItemState.Closed;
    return (
        <input
            className='checkbox'
            type='checkbox'
            checked={isChecked}
            onClick={() => {
                props.onChange(nextState);
            }}
        />);
};

