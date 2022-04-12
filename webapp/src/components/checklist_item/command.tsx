import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';

import {
    clientRunChecklistItemSlashCommand,
} from 'src/client';
import Spinner from 'src/components/assets/icons/spinner';
import {useTimeout} from 'src/hooks';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';
import CommandInput from 'src/components/command_input';

import {CancelSaveButtons} from './inputs';
import {DropdownArrow} from './assign_to';

interface CommandProps {
    playbookRunId: string;
    checklistNum: number;
    itemNum: number;

    disabled: boolean;
    command_last_run: number;
    command: string;
    isEditing: boolean;

    onChangeCommand: (newCommand: string) => void;
}

const RunningTimeout = 1000;

const Command = (props: CommandProps) => {
    const {formatMessage} = useIntl();
    const commandRef = useRef(null);
    const [running, setRunning] = useState(false);
    const dispatch = useDispatch();

    const [commandOpen, setCommandOpen] = useState(false);
    const [wasOpened, setWasOpened] = useState(false);

    // Setting running to true triggers the timeout by setting the delay to RunningTimeout
    useTimeout(() => setRunning(false), running ? RunningTimeout : null);

    // nothing to show if we have not selected command and we are not editing
    if (props.command === '' && !props.isEditing) {
        return null;
    }

    const placeholder = (
        <PlaceholderDiv
            onClick={() => {
                setWasOpened(true);
                setCommandOpen(true);
            }}
        >
            <CommandIcon
                title={formatMessage({defaultMessage: 'Add slash command'})}
                className={'icon-slash-forward icon-12'}
            />
            <CommandTextContainer>
                {formatMessage({defaultMessage: 'Add slash command'})}
            </CommandTextContainer>
            {props.isEditing && <DropdownArrow className={'icon-chevron-down'}/>}
        </PlaceholderDiv>
    );

    const runButton = (
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
            {props.command_last_run ? 'Rerun' : 'Run'}
        </Run>
    );

    const commandButton = (
        <CommandText
            onClick={() => {
                setWasOpened(true);
                setCommandOpen(true);
            }}
        >
            <TextWithTooltipWhenEllipsis
                id={`checklist-command-button-tooltip-${props.checklistNum}`}
                text={props.command}
                parentRef={commandRef}
            />
            {props.isEditing && <i className={'icon-chevron-down'}/>}
        </CommandText>
    );

    const commandDropdown = (
        <EditCommandDropdown
            onDone={() => setCommandOpen(false)}
            onChangeCommand={props.onChangeCommand}
            taskCommand={props.command}
            grabFocus={wasOpened}
        />
    );

    const notEditingCommand = (
        <>
            {!props.disabled && runButton}
            {commandButton}
            {!props.disabled && running && <StyledSpinner/>}
        </>
    );

    const editingCommand = (
        <>
            {props.command === '' ? placeholder : commandButton}
            {commandOpen && commandDropdown}
        </>
    );

    return (
        <CommandContainer
            ref={commandRef}
            editing={props.isEditing}
        >
            {props.isEditing ? editingCommand : notEditingCommand}
        </CommandContainer>
    );
};

const PlaceholderDiv = styled.div`
    display: flex;
    align-items: center;
    flex-direction: row;
`;

const CommandContainer = styled.div<{editing: boolean}>`
    ${({editing}) => editing && css`
        z-index: 49;
    `}

    background: var(--center-channel-color-08);
    border-radius: 54px;
    padding: 0px 4px;
    height: 24px;
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
    margin: 2px 4px 2px 4px;

    &:hover {
        text-decoration: underline;
    }

    ${({running}) => running && `
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: default;

        &:hover {
            text-decoration: none;
        }
    `}
`;

const CommandText = styled.div`
    word-break: break-word;
    display: inline;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 12px;
`;

const StyledSpinner = styled(Spinner)`
    margin-left: 4px;
    padding-top: 3px;
`;

const CommandIcon = styled.i`
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    text-align: center;
    flex: table;
`;

const CommandTextContainer = styled.div`
    font-weight: 400;
    font-size: 12px;
    line-height: 15px;
    margin-right: 4px;
    white-space: nowrap;
`;

export default Command;

interface EditCommandDropdownProps {
    onDone: () => void;
    onChangeCommand: (newCommand: string) => void;
    taskCommand: string;
    grabFocus: boolean;
}

const EditCommandDropdown = (props: EditCommandDropdownProps) => {
    const [command, setCommand] = useState(props.taskCommand);

    return (
        <FormContainer>
            <CommandInputContainer>
                <CommandInput
                    command={command === '' ? '/' : command}
                    setCommand={setCommand}
                    autocompleteOnBottom={true}
                    grabFocus={props.grabFocus}
                />
            </CommandInputContainer>
            <CancelSaveButtons
                onCancel={props.onDone}
                onSave={() => {
                    props.onDone();
                    props.onChangeCommand(command);
                }}
            />
            <Blanket onClick={props.onDone}/>
        </FormContainer>
    );
};

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    position: absolute;
    box-sizing: border-box;
    box-shadow: 0px 20px 32px rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    margin-top: 4px;
    left: 50px;
    right: 50px;

    > * {
        margin-bottom: 10px;
    }
`;

const CommandInputContainer = styled.div`
    margin: 16px;
    border-radius: 4px;
`;

const Blanket = styled.div`
    bottom: 0;
    left: 0;
    top: 0;
    right: 0;
    position: fixed;
    z-index: 1;
`;
