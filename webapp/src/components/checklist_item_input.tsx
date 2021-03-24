import React, {FC, useState, useRef, useEffect} from 'react';

import styled from 'styled-components';

import {TertiaryButton, GrayTertiaryButton} from 'src/components/assets/buttons';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';

import CommandInput from './command_input';
import {StyledTextarea} from './backstage/styles';
import {InputTrashIcon, BaseInput} from './assets/inputs';

interface ChecklistItemCommandProps {
    command: string;
    setCommand: (command: string) => void;
    autocompleteOnBottom: boolean;
}

const SlashCommandContainer = styled.div`
    flex: 0.5;
`;

export const ChecklistItemCommand: FC<ChecklistItemCommandProps> = (props: ChecklistItemCommandProps) => {
    const [commandOpen, setCommandOpen] = useState(props.command.length > 0);

    const setCommand = (command: string) => {
        if (command === '') {
            setCommandOpen(false);
        }
        props.setCommand(command);
    };

    let slashCommandBox = (
        <TertiaryButton
            onClick={() => {
                setCommandOpen(true);
            }}
        >
            <i className='icon-plus'/>
            {'Add a Slash Command'}
        </TertiaryButton>
    );

    if (commandOpen) {
        slashCommandBox = (
            <CommandInput
                command={props.command}
                setCommand={setCommand}
                autocompleteOnBottom={props.autocompleteOnBottom}
                grabFocus={true}
            />
        );
    }

    return (
        <SlashCommandContainer>
            {slashCommandBox}
        </SlashCommandContainer>
    );
};

const DescriptionContainer = styled.div`
    position: relative;
    width: 100%;
    margin: 16px 0 0 0;
    line-height: 40px;
`;

interface ChecklistItemDescriptionProps {
    description: string;
    setDescription: (description: string) => void;
}

export const ChecklistItemDescription: FC<ChecklistItemDescriptionProps> = (props: ChecklistItemDescriptionProps) => {
    const [description, setDescription] = useState(props.description);
    const [descriptionOpen, setDescriptionOpen] = useState(props.description.length > 0);
    const [hover, setHover] = useState(false);
    const [focus, setFocus] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (focus && ref && ref.current) {
            // @ts-ignore
            ref.current.focus();
            setFocus(false);
        }
    }, [focus, setFocus]);

    const save = () => {
        props.setDescription(description);
    };

    let descriptionBox = (
        <GrayTertiaryButton
            onClick={() => {
                setDescriptionOpen(true);
                setFocus(true);
            }}
        >
            <i className='icon-plus icon-12 icon--no-spacing mr-1'/>
            {'Add Optional Description'}
        </GrayTertiaryButton>
    );
    if (descriptionOpen) {
        descriptionBox = (
            <>
                <StyledTextarea
                    ref={ref}
                    value={description}
                    onBlur={save}
                    placeholder={'Description'}
                    onChange={(e) => {
                        setDescription(e.target.value);
                    }}
                />
                <InputTrashIcon show={hover}>
                    <i
                        className='icon-trash-can-outline icon-12 icon--no-spacing mr-1'
                        onClick={() => {
                            setDescriptionOpen(false);
                            setDescription('');
                            props.setDescription('');
                        }}
                    />
                </InputTrashIcon>
            </>
        );
    }

    return (
        <DescriptionContainer
            onMouseOver={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            {descriptionBox}
        </DescriptionContainer>
    );
};

interface ChecklistItemButtonProps {
    onChange: (item: ChecklistItemState) => void;
    item: ChecklistItem;
}

export const ChecklistItemButton: FC<ChecklistItemButtonProps> = (props: ChecklistItemButtonProps) => {
    const isChecked = props.item.state === ChecklistItemState.Closed;

    return (
        <input
            className='checkbox'
            type='checkbox'
            checked={isChecked}
            onChange={() => {
                if (isChecked) {
                    props.onChange(ChecklistItemState.Open);
                } else {
                    props.onChange(ChecklistItemState.Closed);
                }
            }}
        />);
};

interface ChecklistItemTitleProps {
    title: string;
    setTitle: (title: string) => void;
}

export const ChecklistItemTitle: FC<ChecklistItemTitleProps> = (props: ChecklistItemTitleProps) => {
    const [title, setTitle] = useState(props.title);

    const save = () => {
        if (title.trim().length === 0) {
            // Keep the original title from the props.
            setTitle(props.title);
            return;
        }

        props.setTitle(title);
    };

    return (
        <BaseInput
            placeholder={'Task Name'}
            type='text'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            autoFocus={!title}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    save();
                }
            }}
        />
    );
};
