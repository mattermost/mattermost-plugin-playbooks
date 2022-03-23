import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {
    clientRunChecklistItemSlashCommand,
    clientEditChecklistItem,
} from 'src/client';
import Spinner from 'src/components/assets/icons/spinner';
import {useTimeout} from 'src/hooks';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';
import CommandInput from 'src/components/command_input';

import {CancelSaveButtons} from './inputs';

interface CommandProps {
    playbookRunId: string;
    checklistNum: number;
    itemNum: number;

    disabled: boolean;
    command_last_run: number;
    command: string;
    isEditing: boolean;
}

const RunningTimeout = 1000;

const Command = (props: CommandProps) => {
    const {formatMessage} = useIntl();
    const commandRef = useRef(null);
    const [running, setRunning] = useState(false);
    const [lastRun, setLastRun] = useState(props.command_last_run);
    const dispatch = useDispatch();

    const [commandOpen, setCommandOpen] = useState(props.command.length > 0);
    const [wasOpened, setWasOpened] = useState(false);

    // Immediately stop the running indicator when we get notified of a more recent execution.
    if (props.command_last_run > lastRun) {
        setRunning(false);
        setLastRun(props.command_last_run);
    }

    // Setting running to true triggers the timeout by setting the delay to RunningTimeout
    useTimeout(() => setRunning(false), running ? RunningTimeout : null);

    const placeholder = (
        <PlaceholderDiv
            onClick={() => {
                setWasOpened(true);
                setCommandOpen(true);
            }}
        >
            <CommandIcon
                title={formatMessage({defaultMessage: 'Add slash command'})}
                className={'icon-slash-forward icon-16 btn-icon'}
            />
            <CommandTextContainer>
                {formatMessage({defaultMessage: 'Add slash command'})}
            </CommandTextContainer>
        </PlaceholderDiv>
    );
    let slashCommandBox = placeholder;

    if (props.command === '') {
        slashCommandBox = (
            <>
                {placeholder}
                {commandOpen &&
                    <EditCommandDropdown
                        playbookRunId={props.playbookRunId}
                        checklistNum={props.checklistNum}
                        itemNum={props.itemNum}
                        onDone={() => setCommandOpen(false)}
                        taskCommand={props.command}
                        grabFocus={wasOpened}
                    />
                }
            </>
        );
    }

    return (
        <CommandContainer ref={commandRef}>
            {!props.disabled && props.command !== '' &&
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
            }
            {props.command !== '' &&
                <>
                    <CommandText
                        onClick={() => {
                            setWasOpened(true);
                            setCommandOpen(true);
                        }}
                    >
                        <TextWithTooltipWhenEllipsis
                            id={props.checklistNum.toString(10)}
                            text={props.command}
                            parentRef={commandRef}
                        />
                    </CommandText>
                    {running && <StyledSpinner/>}
                </>
            }
            {props.command === '' &&
                slashCommandBox
            }
        </CommandContainer>
    );
};

const CommandContainer = styled.div`
    :not(:first-child) {
        margin-left: 6px;
    }
    z-index: 50;
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
    font-size: 11px;
`;

const StyledSpinner = styled(Spinner)`
    margin-left: 4px;
    padding-top: 3px;
`;

const PlaceholderDiv = styled.div`
    display: flex;
    align-items: center;
    flex-direction: row;
    background: var(--center-channel-color-08);
    border-radius: 100px;
`;

const CommandIcon = styled.i`
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    text-align: center;
    flex: table;
`;

const CommandTextContainer = styled.div`
    color: var(--center-channel-color);
    font-weight: 600;
    font-size: 12px;
    line-height: 15px;
    margin-right: 8px;
`;

export default Command;

interface EditCommandDropdownProps {
    onDone: () => void;
    checklistNum: number;
    playbookRunId: string;
    itemNum: number;
    taskCommand: string;
    grabFocus: boolean;
}

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    position: absolute;
    width: 320px;
    height: 116px;
    box-sizing: border-box;
    box-shadow: 0px 20px 32px rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);

    > * {
        margin-bottom: 10px;
    }
`;

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
                    clientEditChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum, {
                        command,
                    });
                    props.onDone();
                }}
            />
        </FormContainer>
    );
};

const CommandInputContainer = styled.div`
    margin: 16px;
    border-radius: 4px;
`;