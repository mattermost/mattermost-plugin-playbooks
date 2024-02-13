// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {DestructiveButton, PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';

import IconAI from 'src/components/assets/icons/ai';
import Tooltip from 'src/components/widgets/tooltip';
import {useAIAvailable} from 'src/ai_integration';

interface Props {
    collapsed: boolean;
    isDue: boolean;
    isNextUpdateScheduled: boolean;
    updatesExist: boolean;
    disabled: boolean;
    onClick: () => void;
    onAIClick: () => void;
}

const RHSPostUpdateButton = (props: Props) => {
    const {formatMessage} = useIntl();
    const aiAvailable = useAIAvailable();

    let ButtonComponent = PostUpdatePrimaryButton;

    if (props.isDue) {
        ButtonComponent = PostUpdateDestructiveButton;
    } else if (!props.isNextUpdateScheduled && props.updatesExist) {
        ButtonComponent = PostUpdateTertiaryButton;
    }

    return (
        <ButtonsContainer>
            <ButtonComponent
                collapsed={props.collapsed}
                disabled={props.disabled}
                onClick={props.onClick}
            >
                <FormattedMessage defaultMessage='Post update'/>
            </ButtonComponent>
            { aiAvailable &&
            <AIButtonContainer>
                <Tooltip
                    id={'rhs-add-participant'}
                    content={formatMessage({defaultMessage: 'Write with AI'})}
                >
                    <ButtonComponent
                        collapsed={props.collapsed}
                        disabled={props.disabled}
                        onClick={props.onAIClick}
                    >
                        <IconAI/>
                    </ButtonComponent>
                </Tooltip>
            </AIButtonContainer>
            }
        </ButtonsContainer>
    );
};

interface CollapsedProps {
    collapsed: boolean;
}

const ButtonsContainer = styled.div`
	flex-grow: 1;
	display: flex;
	flex-direction: row;
	gap: 2px;
`;

const AIButtonContainer = styled.div`
	display: flex;
	flex-grow: 0;
`;

const PostUpdateButtonCommon = css<CollapsedProps>`
    justify-content: center;
    flex: 1;
    ${(props) => props.collapsed && css`
        font-size: 12px;
        font-height: 9.5px;
    `}
`;

const PostUpdatePrimaryButton = styled(PrimaryButton)<CollapsedProps>`
    ${PostUpdateButtonCommon}
`;

const PostUpdateTertiaryButton = styled(TertiaryButton)<CollapsedProps>`
    ${PostUpdateButtonCommon}
`;

const PostUpdateDestructiveButton = styled(DestructiveButton)<CollapsedProps>`
    ${PostUpdateButtonCommon}
`;

export default RHSPostUpdateButton;
