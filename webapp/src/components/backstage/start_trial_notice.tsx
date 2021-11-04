import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

const EXT = {target: '_blank', rel: 'noreferrer'};

const AgreementLink = styled.a.attrs(() => ({
    ...EXT,
    href: 'https://mattermost.com/software-evaluation-agreement/',
}));

const PrivacyLink = styled.a.attrs(() => ({
    ...EXT,
    href: 'https://mattermost.com/privacy-policy/',
}));

const StartTrialNotice = () => {
    return (
        <FormattedMessage
            defaultMessage='By clicking <b>Start trial</b>, I agree to the <AgreementLink>Mattermost Software Evaluation Agreement</AgreementLink>, <PrivacyLink>Privacy Policy</PrivacyLink>, and receiving product emails.'
            values={{
                b: styled.b,
                AgreementLink,
                PrivacyLink,
            }}
        />
    );
};

export default StartTrialNotice;
