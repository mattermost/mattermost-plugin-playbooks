import React from 'react';

import styled from 'styled-components';

const ConvertEnterpriseNotice = () => (
    <>
        <Subheader>{'To unlock this feature:'}</Subheader>
        <p>
            <StyledOl>
                <li>
                    <a
                        href={'https://docs.mattermost.com/install/ee-install.html#converting-team-edition-to-enterprise-edition'}
                        target={'_blank'}
                        rel='noreferrer'
                    >
                        {'Convert to Enterprise Edition.'}
                    </a>
                </li>
                <li>
                    {'Start a trial or upgrade to Enterprise Edition E10 or E20.'}
                </li>
            </StyledOl>
        </p>
    </>
);

export default ConvertEnterpriseNotice;

const StyledOl = styled.ol`
    list-style-position: inside;
    margin-left: -5px;
`;

const Subheader = styled.p`
    font-weight: 600;
    font-size: 14px;
`;
