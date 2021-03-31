import React, {FC, useEffect, useRef, useState} from 'react';

import styled, {createGlobalStyle} from 'styled-components';

import {useUniqueId} from 'src/utils';

import {BaseInput, InputTrashIcon} from './assets/inputs';

// @ts-ignore
const AutocompleteTextbox = window.Components.Textbox;

const OverrideWebappStyle = createGlobalStyle`
    .custom-textarea.custom-textarea {
        border: none;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        height: 40px;
        min-height: 40px;
    }

    .custom-textarea.custom-textarea:focus {
        border: none;
        box-shadow: inset 0 0 0 2px var(--button-bg);
        padding: 0 30px 0 16px;
    }

    .GenericModal .modal-body .form-control.form-control {
        border: none;
    }

    .modal-body.modal-body {
        overflow: visible;
    }
`;

const AutocompleteWrapper = styled.div`
    position: relative;
    flex-grow: 1;
    height: 40px;
    line-height: 40px;

    input {
        padding-right: 30px;
    }
`;

interface CommandInputProps {
    command: string;
    setCommand: (command: string) => void;
    autocompleteOnBottom: boolean;
    grabFocus?: boolean;
}

const CommandInput: FC<CommandInputProps> = (props: CommandInputProps) => {
    const [command, setCommand] = useState(props.command);
    const [hover, setHover] = useState(false);
    const textboxRef = useRef(null);
    const id = useUniqueId('step-command-');

    useEffect(() => {
        if (props.grabFocus && textboxRef && textboxRef.current) {
            // @ts-ignore
            textboxRef.current.focus();
        }
    }, [props.grabFocus]);

    const save = () => {
        // Discard invalid slash commands.
        if (command.trim() === '/' || command.trim() === '') {
            setCommand('');
            props.setCommand('');
        } else {
            props.setCommand(command);
        }
    };

    return (
        <>
            <OverrideWebappStyle/>
            <AutocompleteWrapper
                onMouseOver={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                <AutocompleteTextbox
                    id={id}
                    ref={textboxRef}
                    inputComponent={BaseInput}
                    createMessage={'Slash Command'}
                    onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                            if (textboxRef.current) {
                                // @ts-ignore
                                textboxRef.current.blur();
                            }
                        }
                    }}
                    onChange={(e: React.FormEvent<HTMLInputElement>) => {
                        if (e.target) {
                            const input = e.target as HTMLInputElement;
                            setCommand(input.value);
                        }
                    }}
                    suggestionListStyle={props.autocompleteOnBottom ? 'bottom' : 'top'}
                    type='text'
                    value={command}
                    onBlur={save}

                    // the following are required props but aren't used
                    characterLimit={256}
                    onKeyPress={() => true}
                    openWhenEmpty={true}
                />
                <InputTrashIcon show={hover}>
                    <i
                        className='icon-trash-can-outline icon-12 icon--no-spacing mr-1'
                        onClick={() => {
                            setCommand('');
                            props.setCommand('');
                        }}
                    />
                </InputTrashIcon>
            </AutocompleteWrapper>
        </>
    );
};

export default CommandInput;
