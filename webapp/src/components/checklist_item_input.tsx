import React, {useState, useRef, useEffect} from 'react';

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

export const ChecklistItemCommand = (props: ChecklistItemCommandProps) => {
    const [commandOpen, setCommandOpen] = useState(props.command.length > 0);
    const [wasOpened, setWasOpened] = useState(false);

    const setCommand = (command: string) => {
        if (command === '') {
            setCommandOpen(false);
        }
        props.setCommand(command);
    };

    let slashCommandBox = (
        <TertiaryButton
            onClick={() => {
                setWasOpened(true);
                setCommandOpen(true);
            }}
        >
            <i className='icon-plus'/>
            {'Add a slash command'}
        </TertiaryButton>
    );

    if (commandOpen) {
        slashCommandBox = (
            <CommandInput
                command={props.command === '' ? '/' : props.command}
                setCommand={setCommand}
                autocompleteOnBottom={props.autocompleteOnBottom}
                grabFocus={wasOpened}
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

export const ChecklistItemDescription = (props: ChecklistItemDescriptionProps) => {
    const [description, setDescription] = useState(props.description);
    const [descriptionOpen, setDescriptionOpen] = useState(props.description.length > 0);
    const [hover, setHover] = useState(false);

    const save = () => {
        props.setDescription(description);
    };

    let descriptionBox = (
        <GrayTertiaryButton
            onClick={() => {
                setDescriptionOpen(true);
            }}
        >
            <i className='icon-plus icon-12 icon--no-spacing mr-1'/>
            {'Add optional description'}
        </GrayTertiaryButton>
    );
    if (descriptionOpen) {
        descriptionBox = (
            <>
                <StyledTextarea
                    autoFocus={!description}
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

export const ChecklistItemButton = (props: ChecklistItemButtonProps) => {
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

const StyledBaseInput = styled(BaseInput)`
    flex: 0.5;
`;

export const ChecklistItemTitle = (props: ChecklistItemTitleProps) => {
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
        <StyledBaseInput
            placeholder={'Task name'}
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
