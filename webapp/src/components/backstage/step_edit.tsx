import React, {FC} from 'react';

import styled from 'styled-components';

import {ChecklistItem} from 'src/types/playbook';
import {ChecklistItemCommand, ChecklistItemDescription, ChecklistItemTitle} from 'src/components/checklist_item_input';

export interface StepEditProps {
    step: ChecklistItem;
    onUpdate: (updatedStep: ChecklistItem) => void
    autocompleteOnBottom: boolean;
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    border-radius: 4px;
    background-color: var(--center-channel-bg);
    padding: 20px;
`;

const StepLine = styled.div`
    display: flex;
    flex-direction: row;
`;

const StepEdit: FC<StepEditProps> = (props: StepEditProps) => {
    const submit = (step: ChecklistItem) => {
        props.onUpdate(step);
    };

    return (
        <Container>
            <StepLine>
                <ChecklistItemTitle
                    title={props.step.title}
                    setTitle={(title) => {
                        if (props.step.title !== title) {
                            submit({...props.step, title});
                        }
                    }}
                />
                <ChecklistItemCommand
                    command={props.step.command}
                    setCommand={(command) => {
                        if (props.step.command !== command) {
                            submit({...props.step, command});
                        }
                    }}
                    autocompleteOnBottom={props.autocompleteOnBottom}
                />
            </StepLine>
            <ChecklistItemDescription
                description={props.step.description}
                setDescription={(description) => {
                    if (props.step.description !== description) {
                        submit({...props.step, description});
                    }
                }}
            />
        </Container>
    );
};

export default StepEdit;
