import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {
    clientRunChecklistItemSlashCommand,
} from 'src/client';
import Spinner from 'src/components/assets/icons/spinner';
import {useTimeout} from 'src/hooks';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';

interface CommandProps {
    playbookRunId: string;
    checklistNum: number;
    itemNum: number;

    disabled: boolean;
    command_last_run: number;
    command: string;
}

const RunningTimeout = 1000;

const Command = (props: CommandProps) => {
    const {formatMessage} = useIntl();
    const commandRef = useRef(null);
    const [running, setRunning] = useState(false);
    const [lastRun, setLastRun] = useState(props.command_last_run);
    const dispatch = useDispatch();

    // Immediately stop the running indicator when we get notified of a more recent execution.
    if (props.command_last_run > lastRun) {
        setRunning(false);
        setLastRun(props.command_last_run);
    }

    // Setting running to true triggers the timeout by setting the delay to RunningTimeout
    useTimeout(() => setRunning(false), running ? RunningTimeout : null);

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
                    <CommandText>
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
                <PlaceholderDiv>
                    <CommandIcon
                        title={formatMessage({defaultMessage: 'Add slash command'})}
                        className={'icon-slash-forward icon-16 btn-icon'}
                    />
                    <CommandTextContainer>
                        {formatMessage({defaultMessage: 'Add slash command'})}
                    </CommandTextContainer>
                </PlaceholderDiv>
            }
        </CommandContainer>
    );
};

const CommandContainer = styled.div`
    :not(:first-child) {
        margin-left: 6px;
    }
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
