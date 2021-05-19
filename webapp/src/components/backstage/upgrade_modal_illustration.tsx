import React from 'react';

import styled from 'styled-components';

import {CenteredRow} from 'src/components/backstage/styles';
import UpgradeSuccessIllustrationSvg from 'src/components/assets/upgrade_success_illustration_svg';
import UpgradeIllustrationSvg from 'src/components/assets/upgrade_illustration_svg';
import {ModalActionState} from 'src/components/backstage/upgrade_modal_data';

interface Props {
    state: ModalActionState;
}

const UpgradeModalIllustrationWrapper = (props: Props) => {
    if (props.state === ModalActionState.Success) {
        return (
            <IllustrationWrapper>
                <UpgradeSuccessIllustrationSvg/>
            </IllustrationWrapper>
        );
    }

    return (
        <IllustrationWrapper>
            <UpgradeIllustrationSvg/>
        </IllustrationWrapper>
    );
};

const IllustrationWrapper = styled(CenteredRow)`
    height: 156px;
`;

export default UpgradeModalIllustrationWrapper;
