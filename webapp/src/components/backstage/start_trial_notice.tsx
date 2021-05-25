import React, {FC} from 'react';

const StartTrialNotice : FC = () => {
    const agreement = (
        <a
            href={'https://mattermost.com/software-evaluation-agreement/'}
            target={'_blank'}
            rel='noreferrer'
        >
            {'Mattermost Software Evaluation Agreement'}
        </a>
    );

    const policy = (
        <a
            href={'https://mattermost.com/privacy-policy/'}
            target={'_blank'}
            rel='noreferrer'
        >
            {'Privacy Policy'}
        </a>
    );

    const startTrial = (
        <b>{'Start trial'}</b>
    );

    return (
        <p>
            {'By clicking '}{startTrial}{', I agree to the '}{agreement}{', '}{policy}{', and receiving product emails.'}
        </p>
    );
};

export default StartTrialNotice;
