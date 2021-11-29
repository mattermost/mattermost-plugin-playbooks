import React from 'react';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

type Props = {
    public: boolean
    setPlaybookPublic: (pub: boolean) => void
    disableOtherOption: boolean
}

const HorizontalContainer = styled.div`
	display: flex;
	flex-direction: horizontal;
	height: 70px;
`;

const BigButton = styled.button`
	padding: 16px;
	border: 1px solid rgba(var(--button-bg-rgb), 0.08);
	background: var(--center-channel-bg);
	box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.08);
	border-radius: 4px;
	flex-grow: 1;
	flex-basis: 0;
	margin: 4px;

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

	display: flex;
	flex-direction: horizontal;
	align-items: center;
`;

const StackedText = styled.div`
	flex-grow: 1;
	text-align: left;
`;

const GiantIcon = styled.i<{active?: boolean}>`
	font-size: 36px;
	line-height: 42px;
	color: ${(props) => (props.active ? 'rgb(var(--button-bg-rgb))' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
`;

const CheckIcon = styled.i`
	font-size: 24px;
	line-height: 24px;
	color: rgb(var(--button-bg-rgb));
`;

const BigText = styled.div`
	font-size: 14px;
	line-height: 20px;
	font-weight: 600;
`;

const SmallText = styled.div`
	font-size: 12px;
	line-height: 16px;
	color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const PublicPrivateSelector = (props: Props) => {
    const {formatMessage} = useIntl();
    const handleButtonClick = (pub: boolean) => {
        props.setPlaybookPublic(pub);
    };

    const publicButtonDisabled = !props.public && props.disableOtherOption;
    const privateButtonDisabled = props.public && props.disableOtherOption;

    return (
        <HorizontalContainer>
            <BigButton
                onClick={(e) => {
                    e.preventDefault();
                    handleButtonClick(true);
                }}
                disabled={publicButtonDisabled}
                title={publicButtonDisabled ? formatMessage({defaultMessage: 'You do not have permissions'}) : formatMessage({defaultMessage: 'Public'})}
            >
                <GiantIcon
                    active={props.public}
                    className={'icon-globe'}
                />
                <StackedText>
                    <BigText>{'Public playbook'}</BigText>
                    <SmallText>{'Anyone on the team can view'}</SmallText>
                </StackedText>
                {props.public &&
                <CheckIcon
                    className={'icon-check-circle'}
                />
                }
            </BigButton>
            <BigButton
                onClick={(e) => {
                    e.preventDefault();
                    handleButtonClick(false);
                }}
                disabled={privateButtonDisabled}
                title={publicButtonDisabled ? formatMessage({defaultMessage: 'You do not have permissions'}) : formatMessage({defaultMessage: 'Private'})}
            >
                <GiantIcon
                    active={!props.public}
                    className={'icon-lock-outline'}
                />
                <StackedText>
                    <BigText>{'Private playbook'}</BigText>
                    <SmallText>{'Only invited members'}</SmallText>
                </StackedText>
                {!props.public &&
                <CheckIcon
                    className={'icon-check-circle'}
                />
                }
            </BigButton>
        </HorizontalContainer>
    );
};

export default PublicPrivateSelector;
