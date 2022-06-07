import React from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import Clock from 'src/components/assets/icons/clock';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {TertiaryButton} from 'src/components/assets/buttons';
import {finishRun} from 'src/actions';

interface Props {
    playbookRun: PlaybookRun;
}

// TODO: replace clock with actual icon
// TODO plug a different endpoint for finish (run command is not enough)
const FinishRun = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    if (props.playbookRun.current_status === PlaybookRunStatus.Finished) {
        return null;
    }

    const onFinishRun = () => dispatch(finishRun(props.playbookRun.team_id || ''));

    return (
        <Container>
            <Content>
                <IconWrapper>
                    <Clock className='icon-size-24'/>
                </IconWrapper>
                <Text>{formatMessage({defaultMessage: 'Time to wrap up?'})}</Text>
                <RightWrapper>
                    <FinishRunButton onClick={onFinishRun}>
                        {formatMessage({defaultMessage: 'Finish run'})}
                    </FinishRunButton>
                </RightWrapper>
            </Content>
        </Container>
    );
};

export default FinishRun;

const Container = styled.div`
    margin: 24px 0;
    display: flex;
    flex-direction: column;

    .icon-size-24 {
        width: 24px;
        height: 24px;
    }
`;

const Content = styled.div`
    display: flex;
    flex-direction: row;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 12px;
    border-radius: 4px;
    height: 56px;
    align-items: center;
`;

const IconWrapper = styled.div`
    margin-left: 4px;
    display: flex;
`;
const Text = styled.div`
    margin: 0 4px;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    display: flex;
`;

const RightWrapper = styled.div`
    display: flex;
    justify-content: flex-end;
    flex: 1;
`;

const FinishRunButton = styled(TertiaryButton)`
    font-size: 12px;
    height: 32px;
    padding: 0 32px;
`;

